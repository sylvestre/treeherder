from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.autoclassify.detectors import ManualDetector
from treeherder.model.models import (Matcher,
                                     MatcherManager)


def test_get_failure_line(webapp, eleven_jobs_stored, jm, failure_lines):
    """
    test getting a single failure line
    """
    job = jm.get_job(1)[0]

    resp = webapp.get(
        reverse("failure-line-detail", kwargs={"pk": job["id"]}))

    assert resp.status_int == 200

    failure_line = resp.json

    assert isinstance(failure_line, object)
    exp_failure_keys = ["id", "job_guid", "repository", "action", "line",
                        "test", "subtest", "status", "expected", "message",
                        "signature", "level", "created", "modified", "matches",
                        "best_classification", "best_is_verified", "classified_failures"]

    assert set(failure_line.keys()) == set(exp_failure_keys)

    jm.disconnect()


def test_update_failure_line_verify(webapp, eleven_jobs_stored, jm, failure_lines,
                                    classified_failures, api_user):

    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    job = jm.get_job(1)[0]

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"best_classification": classified_failures[0].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": job["id"]}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified


def test_update_failure_line_replace(webapp, eleven_jobs_stored, jm, failure_lines,
                                     classified_failures, api_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    job = jm.get_job(1)[0]

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"best_classification": classified_failures[1].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": job["id"]}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification == classified_failures[1]
    assert failure_line.best_is_verified
    assert len(failure_line.classified_failures.all()) == 2

    expected_matcher = Matcher.objects.get(name="ManualDetector")
    assert failure_line.matches.get(classified_failure_id=classified_failures[1].id).matcher == expected_matcher
