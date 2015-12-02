import rest_framework_filters as filters
from rest_framework import viewsets
from rest_framework.decorators import detail_route
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.models import (ClassifiedFailure,
                                     FailureLine)
from treeherder.webapp.api import serializers
from treeherder.webapp.api.utils import as_dict


class ClassifiedFailureFilter(filters.FilterSet):
    class Meta(object):
        model = ClassifiedFailure
        fields = ["bug_number"]


class ClassifiedFailureViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)
    serializer_class = serializers.ClassifiedFailureSerializer
    queryset = ClassifiedFailure.objects.all()
    filter_class = ClassifiedFailureFilter

    def retrieve(self, request, pk=None):
        try:
            obj = ClassifiedFailure.objects.get(id=pk)
        except ClassifiedFailure.DoesNotExist:
            return Response("No classified failure with id %s" % pk, 500)

        return Response(self.serializer_class(obj).data)

    def _create(self, data, many=False):
        rv = []

        for item in data:
            bug = item.get('bug_number')
            if bug:
                obj, _ = ClassifiedFailure.objects.get_or_create(bug_number=bug)
            else:
                obj = ClassifiedFailure()
            obj.save()
            rv.append(obj)

        if not many:
            rv = rv[0]

        return self.serializer_class(rv, many=many).data

    def create(self, request):
        if isinstance(request.data, list):
            return Response(self._create(request.data, many=True))

        return Response(self._create([request.data], many=False))

    def _update(self, data, many=False):
        bug_numbers = {}

        for item in data:
            classified_failure_id = int(item.get("id"))
            if classified_failure_id is None:
                return "No id provided", 400

            bug_number = item.get('bug_number')
            if bug_number is None:
                return "No bug number provided", 400

            bug_numbers[classified_failure_id] = int(bug_number)

        classified_failures = as_dict(
            ClassifiedFailure.objects.filter(id__in=bug_numbers.keys()), "id")

        if len(classified_failures) != len(bug_numbers):
            missing = set(bug_numbers.keys()) - set(classified_failures.keys())
            return "No classified failures with id: {0}".format(", ".join(missing)), 404

        # The other option here would be to merge the classifications.
        existing = ClassifiedFailure.objects.filter(bug_number__in=bug_numbers.values()).all()
        existing = [item for item in existing
                    if item.id not in bug_numbers or item.bug_number != bug_numbers[item.id]]
        if existing:
            return "Bug numbers %s already assigned to classified failures" % (
                ", ".join(str(item.bug_number) for item in existing)), 400

        rv = []
        for classification_id, bug_number in bug_numbers.iteritems():
            obj = classified_failures[classification_id]
            obj.bug_number = bug_number
            obj.save()
            rv.append(obj)

        if not many:
            rv = rv[0]

        return self.serializer_class(rv, many=many).data, 200

    def update(self, request, pk=None):
        data = {"id": pk}
        for k, v in request.data.iteritems():
            if k not in data:
                data[k] = v

        return Response(*self._update([data], many=False))

    def update_many(self, request):
        body, status = self._update(request.data, many=True)

        if status == 404:
            status = 400

        return Response(body, status)

    @detail_route(methods=['get'])
    def matching_lines(self, request, pk=None):
        limit = request.GET.get("limit", 100)
        lines = FailureLine.objects.filter(
            best_classification__id=pk).prefetch_related('matches')[:limit]

        return Response(serializers.FailureLineNoStackSerializer(lines, many=True).data)
