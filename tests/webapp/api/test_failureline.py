import json

from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.autoclassify.detectors import ManualDetector
from treeherder.model.derived import ArtifactsModel
from treeherder.model.models import (Matcher,
                                     MatcherManager)


def test_get_failure_line(webapp, eleven_jobs_stored, jm, failure_lines):
    """
    test getting a single failure line
    """
    resp = webapp.get(
        reverse("failure-line-detail", kwargs={"pk": failure_lines[0].id}))

    assert resp.status_int == 200

    failure_line = resp.json

    assert isinstance(failure_line, object)
    exp_failure_keys = ["id", "job_guid", "repository", "action", "line",
                        "test", "subtest", "status", "expected", "message",
                        "signature", "level", "created", "modified", "matches",
                        "best_classification", "best_is_verified", "classified_failures",
                        "unstructured_bugs"]

    assert set(failure_line.keys()) == set(exp_failure_keys)

    jm.disconnect()


def test_update_failure_line_verify(eleven_jobs_stored, jm, failure_lines,
                                    classified_failures, api_user):

    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": jm.project,
            "best_classification": classified_failures[0].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified


def test_update_failure_line_replace(eleven_jobs_stored, jm, failure_lines,
                                     classified_failures, api_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    failure_line = failure_lines[0]
    assert failure_line.best_classification == classified_failures[0]
    assert failure_line.best_is_verified is False

    body = {"project": jm.project,
            "best_classification": classified_failures[1].id}

    resp = client.put(
        reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
        body, format="json")

    assert resp.status_code == 200

    failure_line.refresh_from_db()

    assert failure_line.best_classification == classified_failures[1]
    assert failure_line.best_is_verified
    assert len(failure_line.classified_failures.all()) == 2

    expected_matcher = Matcher.objects.get(name="ManualDetector")
    assert failure_line.matches.get(classified_failure_id=classified_failures[1].id).matcher == expected_matcher


def test_update_failure_line_mark_job(eleven_jobs_stored, mock_autoclassify_jobs_true,
                                      jm, failure_lines, classified_failures, api_user):

    MatcherManager.register_detector(ManualDetector)

    client = APIClient()
    user = User.objects.create(username="MyName",
                               email="test@example.org")
    client.force_authenticate(user=user)

    job = jm.get_job(1)[0]

    job_failure_lines = [line for line in failure_lines
                         if line.job_guid == job["job_guid"]]

    bs_artifact = {
        'type': 'json',
        'name': 'Bug suggestions',
        'blob': json.dumps([{"search": "TEST-UNEXPECTED-%s %s" % (line.status.upper(),
                                                                  line.message)}
                            for line in job_failure_lines]),
        'job_guid': job['job_guid']
    }

    with ArtifactsModel(jm.project) as artifacts_model:
        artifacts_model.load_job_artifacts(
            [bs_artifact],
            {bs_artifact['job_guid']: job}
        )

    for failure_line in job_failure_lines:

        assert failure_line.best_is_verified is False

        body = {"project": jm.project,
                "best_classification": classified_failures[1].id}

        resp = client.put(
            reverse("failure-line-detail", kwargs={"pk": failure_line.id}),
            body, format="json")

        assert resp.status_code == 200

        failure_line.refresh_from_db()

        assert failure_line.best_classification == classified_failures[1]
        assert failure_line.best_is_verified

    print settings.AUTOCLASSIFY_JOBS
    job = jm.get_job(job['id'])[0]

    assert jm.fully_autoclassified(job['id'])

    notes = jm.get_job_note_list(job['id'])

    assert len(notes) == 1

    assert notes[0]["failure_classification_id"] == 4
    assert notes[0]["who"] == "test@example.org"
