/**
 * betsol-ng-entity-form - Automatic entity forms for Angular.js
 * @version v0.0.0
 * @link https://github.com/betsol/ng-entity-form
 * @license MIT
 *
 * @author Slava Fomin II <s.fomin@betsol.ru>
 */
(function (window, angular) {

  'use strict';


  //====================//
  // PRIVATE PROPERTIES //
  //====================//

  var defaultFieldset = {
    title: '',
    fields: {}
  };

  var defaultField = {
    title: '',
    type: 'string',
    readonly: false,
    required: false
  };


  //=================//
  // ANGULAR MODULES //
  //=================//

  angular.module('betsol.entityForm', [])

    .factory('EntityForm', ['$rootScope', '$injector', function ($rootScope, $injector) {

      var successStrategy = new RedirectStrategy('success');
      var cancelStrategy = new RedirectStrategy('cancel');

      return function (config) {

        if (!config.scope) {
          return console.log('Missing scope');
        }

        if (!config.repository) {
          return console.log('Missing repository');
        }

        var $scope = config.scope;
        var entity = config.entity || {};
        var mode = config.mode || 'create';
        var repository = config.repository;
        var formScheme = normalizeForm(config.scheme || {});

        if ('function' === typeof config.successStrategy) {
          successStrategy = config.successStrategy;
        }

        if ('function' === typeof config.cancelStrategy) {
          cancelStrategy = config.cancelStrategy;
        }

        if ('update' == mode && !entity.id) {
          return console.log('Entity must have an ID in update mode');
        }

        $scope.processing = false;
        $scope.mode = mode;
        $scope.entity = scopeEntityFromEntity(formScheme, entity);
        $scope.formScheme = formScheme;

        $scope.save = function (form) {
          if ($scope.processing) {
            return;
          }
          if (!form.$valid) {
            return alert('Пожалуйста, заполните форму корректно');
          }
          $scope.processing = true;
          var data = getDataToSave(formScheme, $scope.entity);
          if ('update' == mode) {
            data.id = entity.id;
          }
          repository
            .save(data)
            .then(function () {
              $injector.invoke(successStrategy, null, {
                config: config,
                $scope: $scope
              });
            })
            .catch(function () {
              alert('Не удалось сохранить форму, пожалуйста, проверьте вводимые данные');
            })
            .finally(function () {
              $scope.processing = false;
            })
          ;
        };

        $scope.reset = function () {
          $scope.entity = scopeEntityFromEntity(formScheme, entity);
        };

        $scope.cancel = function () {
          $injector.invoke(cancelStrategy, null, {
            config: config,
            $scope: $scope
          });
        };

      }

    }])

  ;


  //===================//
  // PRIVATE FUNCTIONS //
  //===================//

  /**
   * Returns entity to be used inside of scope,
   * based on entity received from the repository.
   *
   * @param {object} formScheme
   * @param {object} entity
   *
   * @returns {object}
   */
  function scopeEntityFromEntity (formScheme, entity) {
    var result = {};
    iterateFields(formScheme, function (fieldName) {
      result[fieldName] = (entity[fieldName] || null);
    });
    return result;
  }

  /**
   * Returns data to be sent to the repository,
   * based on scope entity.
   *
   * @param {object} formScheme
   * @param {object} scopeEntity
   *
   * @returns {object}
   */
  function getDataToSave (formScheme, scopeEntity) {
    var result = {};
    iterateFields(formScheme, function (fieldName, field) {
      if (scopeEntity[fieldName] && !field.readonly) {
        result[fieldName] = (scopeEntity[fieldName]);
      }
    });
    return result;
  }

  /**
   * Normalizes user-provided fields.
   *
   * @param {object} formScheme
   *
   * @returns {object}
   */
  function normalizeForm (formScheme) {
    // Merging with default structures.
    angular.forEach(formScheme, function (fieldset, key) {
      formScheme[key] = angular.extend({}, defaultFieldset, fieldset);
      angular.forEach(formScheme[key].fields, function (field, fieldName) {
        formScheme[key].fields[fieldName] = angular.extend({}, defaultField, field);
      });
    });
    // Adding additional properties used in templating.
    iterateFields(formScheme, function (fieldName, field) {
      switch (field.type) {
        case 'string':
        case 'url':
          field.elementType = 'input';
      }
      switch (field.type) {
        case 'string':
          field.inputType = 'text';
          break;
        default:
          field.inputType = field.type;
      }
    });
    return formScheme;
  }

  /**
   * Iterates specified form scheme fields and
   * executes a specified callback function for each field.
   *
   * @param {array} formScheme
   * @param {function} cb
   */
  function iterateFields (formScheme, cb) {
    angular.forEach(formScheme, function (fieldset, key) {
      angular.forEach(formScheme[key].fields, function (field, fieldName) {
        cb(fieldName, field);
      });
    });
  }

  /**
   * Default redirect strategy constructor for different modes.
   *
   * @param {string} mode
   * @returns {function}
   *
   * @constructor
   */
  function RedirectStrategy (mode) {
    return function (config, $injector) {

      // Trying to redirect to the previous URL first.
      if ($injector.has('previousUrl')) {
        var previousUrl = $injector.get('previousUrl');
        if (previousUrl.hasUrl()) {
          previousUrl.redirectBack();
          return;
        }
      }

      // Using UI router if available.
      if ($injector.has('$state')) {
        var $state = $injector.get('$state');
        if (config.redirectState) {
          // Redirecting to the pre-configured state.
          $state.go(config.redirectState);
        } else {
          // Just reloading the state.
          notifyUser();
          $state.reload();
        }
        return;
      }

      // Using default router if available to refresh the page.
      if ($injector.has('router')) {
        var router = $injector.get('router');
        notifyUser();
        router.reload();
        return;
      }

      // Falling back to vanilla JavaScript.
      notifyUser();
      window.location.reload();


      function notifyUser () {
        if ('success' == mode) {
          alert('Данные успешно сохранены');
        }
      }

    }
  }

})(window, angular);
