from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.models import ClassifiedFailure
from treeherder.webapp.api import serializers


class ClassifiedFailureViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)
    serializer_class = serializers.ClassifiedFailureSerializer

    def retrieve(self, request, pk=None):
        try:
            obj = ClassifiedFailure.objects.get(id=pk)
        except ClassifiedFailure.DoesNotExist:
            return Response("No classified failure with id %i" % pk, 500)

        return Response(self.serializer_class(obj).data)

    def list(self, request):
        queryset = ClassifiedFailure.objects.all()
        query_params = {}
        for key, values in self.request.query_params.iteritems():
            if len(values) > 1:
                if not key.endswith("__in"):
                    key += "__in"
                value = values
            else:
                value = values[0]
            query_params[key] = value
        queryset = queryset.filter(**query_params)
        return Response(self.serializer_class(queryset, many=True).data)

    def create(self, request):
        bug = request.data.get('bug_number')
        if bug:
            obj, _ = ClassifiedFailure.objects.get_or_create(bug_number=bug)
        else:
            obj = ClassifiedFailure()
        obj.save()
        return Response(self.serializer_class(obj).data)

    def update(self, request, pk=None):
        try:
            obj = ClassifiedFailure.objects.get(id=pk)
        except ClassifiedFailure.DoesNotExist:
            return Response("No classified failure with id: {0}".format(pk), 404)

        bug_number = request.data.get('bug_number')
        if bug_number is None:
            return Response("No bug number provided", 400)

        # The other option here would be to merge the classifications.
        try:
            existing = ClassifiedFailure.objects.exclude(id=pk).get(bug_number=bug_number)
            return Response("Bug number %i already used for classification %i" %
                            (bug_number, existing.id), 400)
        except ClassifiedFailure.DoesNotExist:
            pass

        obj.bug_number = bug_number
        obj.save()
        return Response(self.serializer_class(obj).data)
