from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from crawler.service import LinkedClassroomCrawler
from crawler.views import _save_course


class Command(BaseCommand):
    help = "Crawl LinkedClassroom and sync courses into the database"

    def add_arguments(self, parser):
        parser.add_argument("--username", default="")
        parser.add_argument("--password", default="")
        parser.add_argument("--course-ids", nargs="*", type=int, metavar="ID",
                            help="Specific course IDs to sync (omit for all enrolled)")

    def handle(self, *args, **options):
        username = options["username"] or getattr(settings, "LINKEDCLASSROOM_USERNAME", "")
        password = options["password"] or getattr(settings, "LINKEDCLASSROOM_PASSWORD", "")

        if not username or not password:
            raise CommandError(
                "Provide --username/--password or set LINKEDCLASSROOM_USERNAME / "
                "LINKEDCLASSROOM_PASSWORD in Django settings."
            )

        crawler = LinkedClassroomCrawler()
        self.stdout.write("Logging in...")
        try:
            crawler.login(username, password)
        except Exception as exc:
            raise CommandError(f"Login failed: {exc}")
        self.stdout.write(self.style.SUCCESS("Logged in."))

        course_ids = options["course_ids"]
        if course_ids:
            ids_to_sync = [str(cid) for cid in course_ids]
        else:
            self.stdout.write("Fetching enrolled courses...")
            all_courses = crawler.get_all_courses()
            ids_to_sync = list(all_courses.keys())
            self.stdout.write(f"Found {len(ids_to_sync)} course(s): {', '.join(ids_to_sync)}")

        for cid in ids_to_sync:
            self.stdout.write(f"Syncing course {cid}...")
            try:
                data = crawler.get_course_contents(cid)
                course = _save_course(data)
                self.stdout.write(self.style.SUCCESS(
                    f"  ✓ {course.title} ({len(data['sections'])} sections)"
                ))
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"  ✗ course {cid}: {exc}"))

        self.stdout.write(self.style.SUCCESS("Done."))
