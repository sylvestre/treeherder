"use strict";

treeherder.controller('ClassificationPluginCtrl', [
    '$scope', 'ThLog', 'ThFailureLinesModel', 'ThClassifiedFailuresModel',
    '$q', 'thTabs', '$timeout', 'thNotify',
    function ClassificationPluginCtrl(
        $scope, ThLog, ThFailureLinesModel, ThClassifiedFailuresModel,
        $q, thTabs, $timeout, thNotify) {
        var $log = new ThLog(this.constructor.name);

        $log.debug("error classification plugin initialized");

        var timeoutPromise = null;
        var requestPromise = null;
        $scope.lineSelection = {};
        $scope.manualBugs = {};

        $scope.lineClassificationOptions = {};
        $scope.lineClassificationItems = {};

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
                        buildFailureLineOptions(failureLines);
                    }
                })
                .finally(function() {
                    thTabs.tabs.autoClassification.is_loading = false;
                });
        };

        var buildFailureLineOptions = function(failureLines) {
            _.forEach(failureLines, function(line) {

                // used for the selection radio buttons
                var lineOptions = [];
                // used to find the exact object once a selection has been submitted for verification
                var lineItems = {};
                // the classified_failure specified as "best" (if any)
                var best;

                // collect all the classified_failures.  But skip
                // ones with a null bug.  classified_failures with
                // null bugs have no distinguishing features to make
                // them relevant.
                // If the "best" one has a null bug we will add
                // that in later.
                _.forEach(line.classified_failures, function(cf) {
                    if (cf.bug_number !== null) {
                        cf.type = "classified_failure";
                        lineOptions.push(cf);
                        lineItems[cf.id] = cf;
                    }
                });

                // set the best classified_failure
                if (line.best_classification) {
                    best = _.find(
                        line.classified_failures,
                        {id: line.best_classification});

                    best.best = true;
                    best.type = "classified_failure";
                    // move the best one to the top
                    lineOptions = _.without(lineOptions, best);
                    lineOptions = [best].concat(lineOptions);
                    lineItems[best.id] = best;
                    line.best = best;
                }

                // add in unstructured_bugs as options as well
                _.forEach(line.unstructured_bugs, function(bug) {
                    // adding a prefix to the bug id because,
                    // theoretically, however unlikely, it could
                    // conflict with a classified_failure id.
                    var ubid = "ub-" + bug.id;
                    bug.type = "unstructured_bug";
                    lineOptions.push({id: ubid,
                                  bug_number: bug.id,
                                  bug_summary: bug.summary});

                    lineItems[ubid] = bug;
                });

                if (!best || (best && best.bug_number)) {
                    // add a "manual bug" option
                    lineOptions.push({
                        id: "manual",
                        bug_number: null
                    });
                    lineItems.manual = {
                        type: "unstructured_bug",
                        bug_number: null
                    };
                }

                // choose first in list as lineSelection
                $scope.lineClassificationOptions[line.id] = lineOptions;
                $scope.lineClassificationItems[line.id] = lineItems;
                $scope.lineSelection[line.id] = lineOptions[0].id;
            });

        };

        var getSelectedItem = function(line_id) {
            var selectedId = $scope.lineSelection[line_id];
            return $scope.lineClassificationItems[line_id][selectedId];
        };

        $scope.verifyBest = function(line) {
            var selected = getSelectedItem(line.id);
            var bug_number = selected.bug_number ? selected.bug_number : $scope.manualBugs[line.id];

            if (_.parseInt(bug_number)) {

                switch (selected.type) {
                    case "classified_failure":
                        verifyClassifiedFailure(line, selected, bug_number);
                        break;
                    case "unstructured_bug":
                        verifyUnstructuredBug(line, bug_number);
                        break;
                }
            } else {
                thNotify.send("Invalid bug number: " + bug_number, "danger", true);
            }

        };

        var verifyLine = function(line, cf) {
            ThFailureLinesModel.verify(line.id, cf.id)
                .then(function (response) {
                    thNotify.send("Autoclassification has been verified", "success");
                }, function (errorResp) {
                    thNotify.send("Error verifying autoclassification", "danger");
                })
                .finally(function () {
                    thTabs.tabs.autoClassification.update();
                });

        };

        var verifyClassifiedFailure = function(line, cf, bug_number) {
            if (cf.bug_number !== bug_number) {
                // need to update the bug number on it
                var model = new ThClassifiedFailuresModel(cf);
                model.update(bug_number).then(function(updated_cf) {
                    // got the updated cf, now need to verify the line
                    verifyLine(line, updated_cf);
                },
                                              function(error) {
                                                  thNotify.send(error, "danger", true);
                                              });
            } else {
                verifyLine(line, cf);
            }
        };

        var verifyUnstructuredBug = function(line, bug_number) {
            ThClassifiedFailuresModel.create(bug_number)
                .then(function(resp) {
                    // got the updated cf, now need to verify the line
                    verifyLine(line, resp.data);
                },
                      function(error) {
                          thNotify.send(error, "danger", true);
                      });
        };

    }
]);
