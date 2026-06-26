import threading
import urllib.parse
from html import escape as html_escape

import requests as _requests
from bs4 import BeautifulSoup

from django.conf import settings
from django.http import StreamingHttpResponse, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from .models import Course, Section, Activity, Credential
from .serializers import CourseSerializer, CourseListSerializer
from .service import LinkedClassroomCrawler, BASE_URL as LC_BASE, LOGIN_URL as LC_LOGIN_URL

# ---------------------------------------------------------------------------
# Module-level LC session cache (avoids re-login on every image proxy call)
# ---------------------------------------------------------------------------
_lc_sessions: dict = {}  # username -> requests.Session
_lc_sessions_lock = threading.Lock()


def _get_lc_session(username: str, password: str, force_refresh: bool = False):
    if not force_refresh:
        with _lc_sessions_lock:
            sess = _lc_sessions.get(username)
        if sess:
            return sess
    crawler = LinkedClassroomCrawler()
    crawler.login(username, password)
    with _lc_sessions_lock:
        _lc_sessions[username] = crawler.session
    return crawler.session


def _resolve_cred(user):
    """User's own LC credential, falling back to any staff user's credential."""
    try:
        return user.lc_credential
    except Credential.DoesNotExist:
        pass
    return Credential.objects.filter(user__is_staff=True).first()


def _proxy_lc_url(url: str, cred, *, attachment: bool = False):
    """Fetch an LC URL through a cached session and return a StreamingHttpResponse."""
    def _fetch(sess):
        return sess.get(url, timeout=30, stream=True)

    sess = _get_lc_session(cred.username, cred.password)
    resp = _fetch(sess)
    if "login/index.php" in resp.url or resp.status_code in (302, 303):
        sess = _get_lc_session(cred.username, cred.password, force_refresh=True)
        resp = _fetch(sess)

    if resp.status_code != 200:
        return HttpResponse(status=resp.status_code)

    content_type = resp.headers.get("Content-Type", "application/octet-stream")
    django_resp = StreamingHttpResponse(resp.iter_content(chunk_size=8192), content_type=content_type)

    if attachment:
        cd = resp.headers.get("Content-Disposition", "")
        if "attachment" not in cd:
            cd = ("attachment; " + cd).strip("; ")
        django_resp["Content-Disposition"] = cd or "attachment"
        if "Content-Length" in resp.headers:
            django_resp["Content-Length"] = resp.headers["Content-Length"]
    else:
        django_resp["Cache-Control"] = "private, max-age=3600"

    return django_resp


def _save_course(data: dict) -> Course:
    """Upsert a crawled course dict into the database. Returns the Course instance."""
    course, _ = Course.objects.update_or_create(
        course_id=data["course_id"],
        defaults={
            "title": data["course_title"],
            "summary": data["course_summary"],
        },
    )
    course.sections.all().delete()
    for idx, sec in enumerate(data["sections"]):
        section = Section.objects.create(
            course=course,
            title=sec["section_title"],
            url=sec.get("section_url", ""),
            photo_url=sec.get("photo_url") or "",
            tile_icon=sec.get("tile_icon") or "",
            order=idx,
        )
        for aidx, act in enumerate(sec.get("activities", [])):
            Activity.objects.create(
                section=section,
                modtype=act.get("modtype") or "",
                cmid=act.get("cmid") or "",
                title=act.get("title") or "",
                url=act.get("url") or "",
                restricted=act.get("restricted", False),
                order=aidx,
            )
    return course


@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def credentials(request):
    """
    Any logged-in user can manage their own LinkedClassroom credentials.

    GET    — return stored LC username (never returns the password).
    POST   — save/update. Body: {username, password}
    DELETE — clear stored credentials.
    """
    if request.method == "GET":
        try:
            cred = request.user.lc_credential
            return Response({"configured": True, "username": cred.username, "updated_at": cred.updated_at})
        except Credential.DoesNotExist:
            return Response({"configured": False, "username": None})

    if request.method == "POST":
        username = (request.data.get("username") or "").strip()
        password = (request.data.get("password") or "").strip()
        if not username or not password:
            return Response({"error": "username and password are required"}, status=status.HTTP_400_BAD_REQUEST)
        cred, _ = Credential.objects.update_or_create(
            user=request.user,
            defaults={"username": username, "password": password},
        )
        return Response({"configured": True, "username": cred.username, "updated_at": cred.updated_at})

    if request.method == "DELETE":
        Credential.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def sync(request):
    """
    Trigger a LinkedClassroom crawl and store results. Admin only.

    Credential resolution order:
      1. username/password in request body (explicit override)
      2. The requesting user's stored Credential
      3. settings.LINKEDCLASSROOM_USERNAME / LINKEDCLASSROOM_PASSWORD

    Body (JSON):
      username   — optional explicit LC username
      password   — optional explicit LC password
      course_ids — optional list of int IDs to sync; omit to sync all enrolled courses
    """
    try:
        stored = request.user.lc_credential
    except Credential.DoesNotExist:
        stored = None

    username = (
        (request.data.get("username") or "").strip()
        or (stored.username if stored else "")
        or getattr(settings, "LINKEDCLASSROOM_USERNAME", "")
    )
    password = (
        (request.data.get("password") or "").strip()
        or (stored.password if stored else "")
        or getattr(settings, "LINKEDCLASSROOM_PASSWORD", "")
    )
    course_ids = request.data.get("course_ids")

    if not username or not password:
        return Response(
            {"error": "No credentials available. Set them via POST /api/crawler/credentials/ first."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    crawler = LinkedClassroomCrawler()
    try:
        crawler.login(username, password)
    except Exception as exc:
        return Response({"error": f"Login failed: {exc}"}, status=status.HTTP_401_UNAUTHORIZED)

    if course_ids:
        ids_to_sync = [str(cid) for cid in course_ids]
    else:
        try:
            all_courses = crawler.get_all_courses()
        except Exception as exc:
            return Response({"error": f"Failed to list courses: {exc}"}, status=status.HTTP_502_BAD_GATEWAY)
        ids_to_sync = list(all_courses.keys())

    if not ids_to_sync:
        return Response({"synced": [], "message": "No courses found for this account."})

    synced = []
    errors = []
    for cid in ids_to_sync:
        try:
            data = crawler.get_course_contents(cid)
            course = _save_course(data)
            synced.append(CourseListSerializer(course).data)
        except Exception as exc:
            errors.append({"course_id": cid, "error": str(exc)})

    return Response({
        "synced": synced,
        "errors": errors,
        "message": f"Synced {len(synced)} course(s).",
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def course_list(request):
    courses = Course.objects.prefetch_related("sections").all()
    return Response(CourseListSerializer(courses, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def course_detail(request, course_id):
    try:
        course = Course.objects.prefetch_related("sections__activities").get(course_id=course_id)
    except Course.DoesNotExist:
        return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(CourseSerializer(course).data)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def clear_session_cache(request):
    """Clear all cached LC sessions so the next request forces a fresh login."""
    with _lc_sessions_lock:
        count = len(_lc_sessions)
        _lc_sessions.clear()
    return Response({"cleared": count, "message": f"已清除 {count} 个缓存会话。"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def image_proxy(request):
    url = request.GET.get("url", "").strip()
    if not url or not url.startswith(f"{LC_BASE}/"):
        return HttpResponse(b"Invalid URL", status=400, content_type="text/plain")
    cred = _resolve_cred(request.user)
    if cred is None:
        return HttpResponse(b"No LC credentials configured", status=403, content_type="text/plain")
    return _proxy_lc_url(url, cred)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_resource(request):
    """Proxy-download any LC resource file. Query param: url"""
    url = request.GET.get("url", "").strip()
    if not url or not url.startswith(f"{LC_BASE}/"):
        return HttpResponse(b"Invalid URL", status=400, content_type="text/plain")
    cred = _resolve_cred(request.user)
    if cred is None:
        return HttpResponse(b"No LC credentials configured", status=403, content_type="text/plain")
    return _proxy_lc_url(url, cred, attachment=True)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def browser_login(request):
    """
    Returns an HTML page that auto-submits the user's LC credentials directly
    to linkedclassroom.com. LC's Set-Cookie response installs MoodleSession
    in the browser for linkedclassroom.com, enabling direct image/resource URLs.
    """
    cred = _resolve_cred(request.user)
    if cred is None:
        return HttpResponse(b"No LC credentials configured", status=403, content_type="text/plain")

    # Fetch a fresh logintoken (Moodle CSRF token, changes each page load)
    try:
        temp = _requests.Session()
        temp.headers["User-Agent"] = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
        )
        r = temp.get(LC_LOGIN_URL, timeout=10)
        soup = BeautifulSoup(r.text, "html.parser")
        token_el = soup.find("input", {"name": "logintoken"})
        logintoken = html_escape(token_el["value"]) if token_el else ""
    except Exception:
        logintoken = ""

    u = html_escape(cred.username)
    p = html_escape(cred.password)
    action = html_escape(LC_LOGIN_URL)

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>正在登录 LinkedClassroom…</title>
  <style>
    body {{
      margin: 0; font-family: sans-serif;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; background: #f0f9ff; color: #0369a1;
      flex-direction: column; gap: 12px;
    }}
    .spinner {{
      width: 32px; height: 32px; border: 3px solid #bae6fd;
      border-top-color: #0284c7; border-radius: 50%;
      animation: spin .8s linear infinite;
    }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>正在登录 LinkedClassroom，请稍候…</p>
  <form id="f" method="POST" action="{action}">
    <input type="hidden" name="logintoken" value="{logintoken}">
    <input type="hidden" name="username"   value="{u}">
    <input type="hidden" name="password"   value="{p}">
    <input type="hidden" name="rememberusername" value="1">
    <input type="hidden" name="anchor"     value="">
  </form>
  <script>document.getElementById('f').submit();</script>
</body>
</html>"""
    return HttpResponse(html, content_type="text/html; charset=utf-8")
