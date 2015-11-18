'use strict';

treeherder.factory('ThFailureLinesModel', [
    '$http', 'ThLog', 'thUrl',
    function($http, ThLog, thUrl) {

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

        ThFailureLinesModel.verify = function(job_id, line_id, best_classification) {
            return $http.put(thUrl.getRootUrl("/failure-line/" + line_id + "/"),
                             {best_classification: best_classification});
        };

        return ThFailureLinesModel;
    }]);
