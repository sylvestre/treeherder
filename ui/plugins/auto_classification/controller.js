"use strict";

treeherder.controller('ClassificationPluginCtrl', [
    '$scope', 'ThLog', 'ThFailureLinesModel','$q', 'thTabs', '$timeout', 'thNotify',
    function ClassificationPluginCtrl(
        $scope, ThLog, ThFailureLinesModel, $q, thTabs, $timeout, thNotify) {
        var $log = new ThLog(this.constructor.name);

        $log.debug("error classification plugin initialized");

        var timeoutPromise = null;
        var requestPromise = null;
        $scope.lineBest = {};
        $scope.manualBugs = {};

        $scope.lineClassificationOptions = {};

        thTabs.tabs.autoClassification.update = function() {
            $scope.jobId = thTabs.tabs.autoClassification.contentId;
            // if there's an ongoing timeout, cancel it
            if (timeoutPromise !== null) {
                $timeout.cancel(timeoutPromise);
            }
            // if there's a ongoing request, abort it
            if (requestPromise !== null) {
                requestPromise.resolve();
            }

            requestPromise = $q.defer();

            thTabs.tabs.autoClassification.is_loading = true;
            ThFailureLinesModel.get_list($scope.jobId, {timeout: requestPromise})
                .then(function(failureLines) {
                    $scope.failureLines = failureLines;
                    $scope.failureLinesLoaded = failureLines.length > 0;
                    if (!$scope.failureLinesLoaded) {
                        timeoutPromise = $timeout(thTabs.tabs.autoClassification.update, 5000);
                    } else {

                        _.forEach(failureLines, function(line) {
                            // map bug numbers to classified failure ids or 0
                            // used for the selection radio buttons
                            var options = line.classified_failures.slice();

                            // set the best classified_failure to a value or -1 if not set
                            if (line.best_classification) {
                                var best = _.find(
                                    line.classified_failures,
                                    {id: line.best_classification});

                                $scope.lineBest[line.id] = best.id || -1;
                                // move the best one to the top
                                options = _.without(options, best);
                                options = [best].concat(options);
                            }

                            _.forEach(line.unstructured_bugs, function(bug) {
                                options.push({id: -1, bug_number: bug.id});
                            });

                            options.push({id: -1, bug_number: null});

                            $scope.lineClassificationOptions[line.id] = options;
                        });
                    }
                })
                .finally(function() {
                    thTabs.tabs.autoClassification.is_loading = false;
                });
        };

        $scope.selected = function() {
            //console.log("lineBest", $scope.lineBest);
        };

        $scope.verifyBest = function(lineIndex) {
            var failureLine = $scope.failureLines[lineIndex];
            ThFailureLinesModel.verify($scope.jobId, failureLine.id, failureLine.best_classification)
                .then(function(response) {
                        thNotify.send("Autoclassification has been verified");
                    }, function(errorResp) {
                        thNotify.send("Error verifying autoclassification");
                    }
                .finally(function() {
                    thTabs.tabs.autoClassification.update();
                })
            );
        };

        $scope.getBugSummary = function(bugNumber) {
            //console.log(bugNumber, $scope.failureLines.unstructured_bugs);
            //console.log(_.find($scope.failureLines.unstructured_bugs, {id: bugNumber}));
            return _.result(_.find($scope.failureLines.unstructured_bugs, "id", bugNumber), "summary");
        };
    }
]);
