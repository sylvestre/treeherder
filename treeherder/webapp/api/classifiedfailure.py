from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from treeherder.model.models import ClassifiedFailure
from treeherder.webapp.api import serializers


class ClassifiedFailureViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)
    queryset = ClassifiedFailure.objects.all()
    serializer_class = serializers.ClassifiedFailureSerializer
