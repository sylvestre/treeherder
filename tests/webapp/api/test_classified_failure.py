from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.model.models import ClassifiedFailure


def test_get_classified_failure(webapp, classified_failures):
    """
    test getting a single failure line
    """
    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = webapp.get(
        reverse("classified-failure-detail", kwargs={"pk": classified_failures[0].id}))

    assert resp.status_int == 200
    actual = resp.json
    expected = {"id": classified_failures[0].id,
                "bug_number": 1234}

    assert actual == expected


def test_get_classified_failures(webapp, classified_failures):
    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = webapp.get(reverse("classified-failure-list"))
    assert resp.status_int == 200

    actual = resp.json
    expected = [{"id": cf.id,
                 "bug_number": cf.bug_number} for cf in classified_failures]
    assert actual == expected


def test_get_classified_failures_bug(webapp, classified_failures):
    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = webapp.get(reverse("classified-failure-list") + "?bug_number=1234")
    assert resp.status_int == 200

    actual = resp.json
    expected = [{"id": classified_failures[0].id,
                 "bug_number": classified_failures[0].bug_number}]
    assert actual == expected


def test_post_new_classified_failure(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.post(reverse("classified-failure-list"),
                       {"bug_number": 5678}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[-1].id + 1,
                "bug_number": 5678}
    assert actual == expected

    obj = ClassifiedFailure.objects.get(id=actual["id"])
    assert obj.bug_number == 5678


def test_post_repeated_classified_failure(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.post(reverse("classified-failure-list"),
                       {"bug_number": 1234}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[0].id,
                "bug_number": 1234}
    assert actual == expected


def test_put_new_bug_number(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.put(reverse("classified-failure-detail",
                              kwargs={"pk": classified_failures[0].id}),
                      {"bug_number": 5678}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[0].id,
                "bug_number": 5678}
    assert actual == expected

    classified_failures[0].refresh_from_db()
    assert classified_failures[0].bug_number == 5678


def test_put_existing_bug_number(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.put(reverse("classified-failure-detail",
                              kwargs={"pk": classified_failures[0].id}),
                      {"bug_number": 1234}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[0].id,
                "bug_number": 1234}
    assert actual == expected

    classified_failures[0].refresh_from_db()
    assert classified_failures[0].bug_number == 1234


def test_put_duplicate_bug_number(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.put(reverse("classified-failure-detail",
                              kwargs={"pk": classified_failures[1].id}),
                      {"bug_number": 1234}, format="json")

    assert resp.status_code == 400
