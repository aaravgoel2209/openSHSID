"""
LinkedClassroom (Moodle) crawler — stateless service class.
All methods raise requests.HTTPError on network failures.
"""
import time
import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from OpenSHSID_backend.config_loader import cfg

CRAWL_CFG = cfg['crawler']

BASE_URL = CRAWL_CFG['base_url']
LOGIN_URL = f"{BASE_URL}{CRAWL_CFG['login_path']}"


class LinkedClassroomCrawler:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": CRAWL_CFG['user_agent']
        })
        self.logged_in = False

    def login(self, username: str, password: str) -> bool:
        resp = self.session.get(LOGIN_URL, timeout=CRAWL_CFG['timeout'])
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        token_input = soup.find("input", {"name": "logintoken"})
        if token_input is None:
            raise ValueError("Could not find logintoken on login page — page structure may have changed")

        login_resp = self.session.post(LOGIN_URL, data={
            "logintoken": token_input.get("value"),
            "username": username,
            "password": password,
            "rememberusername": "1",
            "anchor": "",
        }, timeout=CRAWL_CFG['timeout'])
        login_resp.raise_for_status()

        # Success: redirected to dashboard or /my/
        success = (
            login_resp.url.rstrip("/") == BASE_URL
            or "/my" in login_resp.url
            or "dashboard" in login_resp.url
        )
        if not success:
            soup2 = BeautifulSoup(login_resp.text, "html.parser")
            err = soup2.find("div", class_="alert-danger")
            raise ValueError(err.get_text(strip=True) if err else "Login failed (unknown reason)")

        self.logged_in = True
        return True

    def get_all_courses(self) -> dict[str, str]:
        """Return {course_id: course_name} for the logged-in user."""
        resp = self.session.get(f"{BASE_URL}/my/", timeout=CRAWL_CFG['timeout'])
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        courses = {}

        def _extract(tag):
            href = tag.get("href", "")
            m = re.search(r"/course/view\.php\?id=(\d+)", href)
            if m:
                cid = m.group(1)
                name = tag.get_text(strip=True)
                if name:
                    courses[cid] = name

        # sidebar "My courses"
        for a in soup.select('li[data-key="mycourses"] a[href]'):
            _extract(a)

        # coursebox tiles on the page
        for box in soup.find_all("div", class_="coursebox"):
            a = box.find("a", href=True)
            if a:
                _extract(a)

        # data-region course content
        region = soup.find(attrs={"data-region": "course-view-content"})
        if region:
            for a in region.find_all("a", href=True):
                _extract(a)

        # fall back to course index
        if not courses:
            resp2 = self.session.get(f"{BASE_URL}/course/index.php?categoryid=0", timeout=CRAWL_CFG['timeout'])
            resp2.raise_for_status()
            soup2 = BeautifulSoup(resp2.text, "html.parser")
            for box in soup2.find_all("div", class_="coursebox"):
                a = box.find("a", href=True)
                if a:
                    _extract(a)

        return courses

    def _parse_activity(self, act) -> dict:
        classes = act.get("class", [])
        modtype = next((c.replace("modtype_", "") for c in classes if c.startswith("modtype_")), None)
        cmid = act.get("data-cmid")
        restricted = bool(act.find("div", class_="availabilityinfo"))

        title_span = act.find("span", class_="instancename")
        if title_span:
            a = title_span.find("a")
            if a:
                title = a.get_text(strip=True)
                url = urljoin(BASE_URL, a.get("href")) if a.get("href") else None
            else:
                title = title_span.get_text(strip=True)
                url = None
        else:
            title = act.get("data-title", "").strip()
            url = act.get("data-url")

        return {
            "modtype": modtype,
            "cmid": cmid,
            "title": title,
            "url": url,
            "restricted": restricted,
        }

    def get_course_contents(self, course_id: int | str) -> dict:
        """Return full course structure: title, summary, list of sections with activities."""
        course_url = f"{BASE_URL}/course/view.php?id={course_id}"
        resp = self.session.get(course_url, timeout=CRAWL_CFG['timeout'])
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        h1 = soup.find("h1")
        course_title = h1.get_text(strip=True) if h1 else ""

        summary_text = ""
        section0 = soup.find("li", {"id": "section-0"})
        if section0:
            summary_div = section0.find("div", class_="summary")
            if summary_div:
                summary_text = summary_div.get_text(separator=" ", strip=True)

        sections = []

        # section-0 activities (course home resources)
        if section0:
            activities = section0.find_all("li", class_="activity")
            if activities:
                sections.append({
                    "section_title": "Course home",
                    "section_url": course_url,
                    "activities": [self._parse_activity(a) for a in activities],
                })

        # tile-based chapters
        for tile in soup.select("li.tile.tile-clickable"):
            a = tile.find("a", class_="tile-link")
            if not a or not a.get("href"):
                continue
            section_url = urljoin(BASE_URL, a["href"])
            title_elem = tile.find("h3") or tile.find("span", class_="tile-textinner")
            section_title = title_elem.get_text(strip=True) if title_elem else "未命名章节"

            # Photo tile: background-image in style attr
            photo_url = None
            style = tile.get("style", "")
            m = re.search(r'background-image:\s*url\(["\']?([^"\')\s]+)["\']?\)', style)
            if m:
                photo_url = m.group(1)

            # Icon tile: fa-* class on the icon element
            tile_icon = None
            if not photo_url:
                icon_tag = tile.find("i", class_=True)
                if icon_tag:
                    for cls in icon_tag.get("class", []):
                        if cls.startswith("fa-") and cls != "fa-fw":
                            tile_icon = cls
                            break

            try:
                sec_resp = self.session.get(section_url, timeout=CRAWL_CFG['timeout'])
                sec_resp.raise_for_status()
                sec_soup = BeautifulSoup(sec_resp.text, "html.parser")

                activities = []
                for ul in sec_soup.find_all("ul", class_=lambda c: c and ("section" in c or "img-text" in c)):
                    activities.extend(ul.find_all("li", class_="activity"))
                if not activities:
                    activities = sec_soup.find_all("li", class_="activity")
                if not activities:
                    cc = sec_soup.find("div", class_="course-content")
                    if cc:
                        activities = cc.find_all("li", class_="activity")

                sections.append({
                    "section_title": section_title,
                    "section_url": section_url,
                    "photo_url": photo_url,
                    "tile_icon": tile_icon,
                    "activities": [self._parse_activity(a) for a in activities],
                })
            except Exception as exc:
                sections.append({
                    "section_title": section_title,
                    "section_url": section_url,
                    "photo_url": photo_url,
                    "tile_icon": tile_icon,
                    "activities": [],
                    "error": str(exc),
                })

            time.sleep(0.5)

        return {
            "course_id": str(course_id),
            "course_title": course_title,
            "course_summary": summary_text,
            "sections": sections,
        }

    def scrape_folder(self, folder_url: str) -> list[dict]:
        """Return list of {name, url} for all files in a Moodle folder page."""
        resp = self.session.get(folder_url, timeout=CRAWL_CFG['timeout'])
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        files = []
        for item in soup.select("span.fp-filename-icon"):
            a = item.find("a")
            if not a or not a.get("href"):
                continue
            name_span = a.find("span", class_="fp-filename")
            name = name_span.get_text(strip=True) if name_span else (a.get_text(strip=True) or a.get("title", ""))
            if name:
                files.append({"name": name, "url": a["href"]})
        return files
