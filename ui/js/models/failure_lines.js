'use strict';

treeherder.factory('ThFailureLinesModel', [
    '$http', 'ThLog', 'thUrl', 'ThClassifiedFailuresModel', 'thNotify', '$q',
    function($http, ThLog, thUrl, ThClassifiedFailuresModel, thNotify, $q) {

        var ThFailureLinesModel = function(data) {
            angular.extend(this, data);
        };

        ThFailureLinesModel.get_url = function(job_id) {
            return thUrl.getProjectJobUrl("/failure_lines/", job_id);
        };

        ThFailureLinesModel.get_list = function(job_id, config) {
            // a static method to retrieve a list of ThFailureLinesModel
            // the timeout configuration parameter is a promise that can be used to abort
            // the ajax request
            config = config || {};
            var timeout = config.timeout || null;
            return $http.get(ThFailureLinesModel.get_url(job_id), {
                timeout: timeout
            })
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThFailureLinesModel(elem));
                });
                return item_list;
            });
        };

        ThFailureLinesModel.verify = function(line_id, bug_number) {
            return ThClassifiedFailuresModel.get_or_create_for_bug(bug_number)
                .then(function(response) {
                    console.log(response.data);
                    if (response.data.length > 1) {
                        thNotify.send("got too many classified_failures", "danger", true);
                        return $q.reject("got too many classified_failures");
                    } else {
                        return $http.put(thUrl.getRootUrl("/failure-line/" + line_id + "/"),
                                         {best_classification: response.data[0].id});
                    }

                }, function(error) {
                    thNotify.send("Can't verify without a classification for bug " + bug_number, "danger", true);
                    return $q.reject();
                });
        };

        return ThFailureLinesModel;
    }]);
