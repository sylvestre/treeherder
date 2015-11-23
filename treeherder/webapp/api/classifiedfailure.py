import rest_framework_filters as filters
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.models import ClassifiedFailure
from treeherder.webapp.api import serializers


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
            return Response("No classified failure with id %i" % pk, 500)

        return Response(self.serializer_class(obj).data)

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
