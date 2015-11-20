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
                            var options = _.filter(line.classified_failures, function(cf) {
                                return cf.bug_number !== null;
                            });

                            // set the best classified_failure to a value or -1 if not set
                            if (line.best_classification) {
                                var best = _.find(
                                    line.classified_failures,
                                    {id: line.best_classification});

                                // don't add to options if no bug number
                                if (best.bug_number) {
                                    // move the best one to the top
                                    options = _.without(options, best);
                                    options = [best].concat(options);
                                }
                            }

                            _.forEach(line.unstructured_bugs, function(bug) {
                                options.push({id: bug.id, bug_number: bug.id, bug_summary: bug.summary});
                            });

                            // add a "manual bug" option
                            options.push({id: "manual"});

                            // choose first in list as lineBest
                            $scope.lineClassificationOptions[line.id] = options;
                            $scope.lineBest[line.id] = options[0].id;
                        });
                    }
                })
                .finally(function() {
                    thTabs.tabs.autoClassification.is_loading = false;
                });
        };

        var getChosenBug = function(line_id) {
            if ($scope.lineBest[line_id] === 'manual') {
                return $scope.manualBugs[line_id];
            } else {
                return $scope.lineBest[line_id];
            }

        };

        $scope.verifyBest = function(lineIndex) {
            var failureLine = $scope.failureLines[lineIndex];

            ThFailureLinesModel.verify(failureLine.id, getChosenBug(failureLine.id))
                .then(function(response) {
                    thNotify.send("Autoclassification has been verified", "success");
                }, function(errorResp) {
                    thNotify.send("Error verifying autoclassification", "danger");
                })
                .finally(function() {
                    thTabs.tabs.autoClassification.update();
                }
            );
        };
    }
]);
