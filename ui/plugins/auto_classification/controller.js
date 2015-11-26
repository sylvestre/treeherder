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
                line.ui = {};

                // used for the selection radio buttons
                line.ui.options = [];
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
                        line.ui.options.push(cf);
                    }
                });

                // set the best classified_failure
                if (line.best_classification) {
                    best = _.find(
                        line.classified_failures,
                        {id: line.best_classification});

                    best.is_best = true;
                    best.type = "classified_failure";

                    // move the best one to the top
                    line.ui.options = _.without(line.ui.options, best);
                    line.ui.options = [best].concat(line.ui.options);
                    line.ui.best = best;
                }

                // add in unstructured_bugs as options as well
                _.forEach(line.unstructured_bugs, function(bug) {
                    // adding a prefix to the bug id because,
                    // theoretically, however unlikely, it could
                    // conflict with a classified_failure id.
                    var ubid = "ub-" + bug.id;
                    line.ui.options.push({id: ubid,
                                          bug_number: bug.id,
                                          bug_summary: bug.summary,
                                          type: "unstructured_bug"});

                });

                if (!best || (best && best.bug_number)) {
                    // add a "manual bug" option
                    line.ui.options.push({
                        id: "manual",
                        type: "unstructured_bug",
                        bug_number: null
                    });
                }

                // choose first in list as lineSelection
                line.ui.selectedOption = 0;
            });

        };

        $scope.getSaveButtonText = function(line) {
            if (line.best_classification === line.ui.options[line.ui.selectedOption].id) {
                return "Verify";
            } else {
                return "Save";
            }
        };

        $scope.save = function(line) {
            var selected = line.ui.options[line.ui.selectedOption];
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
                model.update(bug_number).then(
                    function(updated_cf_resp) {
                        // got the updated cf, now need to verify the line
                        verifyLine(line, updated_cf_resp.data);
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
