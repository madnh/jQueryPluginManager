;(function ($, window, document, undefined) {
    var jQueryPlugin = {
        _plugins: {}
    };

    window.jQueryPlugin = jQueryPlugin;

    /**
     * Check if a plugin is registered
     * @param {string} name
     * @return {boolean}
     */
    jQueryPlugin.isRegistered = function (name) {
        return this._plugins.hasOwnProperty(name);
    };

    /**
     * Register plugin
     * @param {string} name
     * @param {object} detail
     * Object with keys:
     * - handler: function, parameters are:
     *  + element: object, keys maybe is "container" or "target", both values is jQuery element
     *  + options: object
     *
     * - options: default options
     * - available: boolean/function. Default is TRUE. If its function, parameters are:
     *  + container: jQuery element
     *  + apply option: object
     *  + plugin options: plugin's default options
     *
     *  - selector: selector to pre-query elements. Default is null
     *  - except_selector: Default is null
     *
     * @return {boolean}
     */
    jQueryPlugin.register = function (name, detail) {
        if (!this._plugins.hasOwnProperty(name)) {
            this._plugins[name] = createPluginDetail(detail);
            return true;
        }

        return false;
    };
    /**
     * Re-register plugin
     * @inheritDoc register
     */
    jQueryPlugin.reRegister = function (name, detail) {
        delete this._plugins[name];

        this._plugins[name] = createPluginDetail(detail);
    };

    function createPluginDetail(detail) {
        return $.extend({
            handler: null,
            options: {},
            available: true,
            selector: null,
            except_selector: null
        }, detail || {});
    }

    /**
     * Get plugin detail
     * @param {string} name
     * @return {{}}
     */
    jQueryPlugin.detail = function (name) {
        if (this._plugins.hasOwnProperty(name)) {
            return this._plugins[name];
        }

        return false;
    };

    /**
     * Apply plugins to containers
     * @param {string|object} container_selector Container's selector or jQuery elements
     * @param {{}} options Apply plugin's options
     * @param {{}} apply_condition object with keys:
     * - only: white list, array of plugins name
     * - except: black list, array of plugins name
     * - times: maximum of apply times. Number or boolean. Default is false
     * - last_status: apply plugin base on last apply status of it self. Boolean (TRUE - success, FALSE - failed) or null (no matter status), default is null
     */
    jQueryPlugin.applyContainer = function (container_selector, options, apply_condition) {
        var self = this,
            result = {},
            containers = query(container_selector);

        apply_condition = get_apply_condition(apply_condition);

        if (!containers.length) {
            return result;
        }

        $.each(containers, function (index, container) {
            container = $(container);
            var apply_history = container.data('apply_history') || [];

            if (apply_history.length && $.isNumeric(apply_condition.times) && (apply_history.length + 1) > apply_condition.times) {
                return;
            }

            if (!$.isPlainObject(options)) {
                options = {};
            }

            var pluginsToApply = get_apply_plugins(apply_condition, container, options);

            $.each(pluginsToApply, function (index, apply_plugin) {
                result[apply_plugin.plugin] = false !== self._plugins[apply_plugin.plugin].handler({
                        container: container,
                        target: apply_plugin.target
                    }, apply_plugin.options);

                pluginsToApply[index].is_success = result[apply_plugin.plugin];
            });

            apply_history.push(pluginsToApply.slice());
            container.data('apply_history', apply_history);
        });

        return result;
    };

    /**
     * Apply plugins to containers only one times
     * @param container_selector
     * @param options
     * @param apply_detail
     */
    jQueryPlugin.applyContainerOnce = function (container_selector, options, apply_detail) {
        apply_detail = get_apply_condition(apply_detail);
        apply_detail.times = 1;

        this.applyContainer(container_selector, options, apply_detail);
    };

    /**
     * Apply a plugin to a target selector
     * @param target
     * @param plugin
     * @param options
     */
    jQueryPlugin.applyTarget = function (target, plugin, options) {
        if (!this.isRegistered(plugin)) {
            throw new Error('jQuery Plugin Manager: apply an unregistered plugin (' + plugin + ')');
        }

        target = $(target);
        if (!target.length) {
            return;
        }

        options = $.extend({}, jQueryPlugin._plugins[plugin].options, options);

        if (!is_available(plugin, {target: target}, $.extend({}, options))) {
            return;
        }

        this._plugins[plugin].handler({target: target}, options);
    };

    /**
     * Get applied history of a container
     * @param {string|object} container_selector
     * @return {*|Array}
     */
    jQueryPlugin.containerHistory = function (container_selector) {
        var container = $(query(container_selector));

        if (!container.length) {
            return [];
        }

        return container.data('apply_history') || [];
    };

    jQueryPlugin.lastContainerHistoryEntry = function (container_selector, filter_status) {
        var history = this.containerHistory(container_selector),
            result = [];

        if (history.length) {
            if (typeof filter_status == 'undefined') {
                return $.extend({}, history[history.length - 1]);
            }
            $.each(history[history.length - 1], function (index, detail) {
                if (filter_status === detail.is_success) {
                    result.push(detail);
                }
            });
        }

        return result.slice();
    };


    /**
     *
     * @param apply_condition
     * @return {{only: Array, except: Array, times: boolean, last_status: null}}
     */
    function get_apply_condition(apply_condition) {
        if (typeof apply_condition === 'string') {
            apply_condition = [apply_condition];
        }
        if ($.isArray(apply_condition)) {
            apply_condition = {
                only: apply_condition
            };
        }
        if (!$.isPlainObject(apply_condition)) {
            apply_condition = {};
        }

        return $.extend({
            only: [],
            except: [],
            times: false,
            last_status: null
        }, apply_condition);
    }

    /**
     * Get plugins name will call
     * @param {object} apply_detail
     * @param container jQuery element
     * @param {object} apply_options
     * @return {Array}
     */
    function get_apply_plugins(apply_detail, container, apply_options) {
        var plugins = Object.keys(jQueryPlugin._plugins);

        if (apply_detail.only.length) {
            plugins = array_intersection(apply_detail.only, plugins);
        }
        if(apply_detail.last_status !== null){
            var last_status_detail = jQueryPlugin.lastContainerHistoryEntry(container, apply_detail.last_status);
            var last_status_plugin = [];

            $.each(last_status_detail, function (index, detail) {
                last_status_plugin.push(detail.plugin);
            });

            plugins = array_intersection(plugins, last_status_plugin);
        }
        if (!apply_detail.except.length) {
            plugins = array_flip(plugins);
            $.each(apply_detail.except, function (index, plugin_name) {
                if (plugins.hasOwnProperty(plugin_name)) {
                    delete plugins[plugin_name];
                }
            });

            plugins = Object.keys(plugins);
        }

        var result = [];

        $.each(plugins, function (index, plugin_name) {
            if (jQueryPlugin._plugins.hasOwnProperty(plugin_name)) {
                var target = null,
                    plugin_detail = jQueryPlugin._plugins[plugin_name];

                if (plugin_detail.selector) {
                    target = container.find(plugin_detail.selector);

                    if (target.length && plugin_detail.except_selector) {
                        target = target.not(plugin_detail.except_selector);
                    }
                    if (!target.length) {
                        return;
                    }
                }

                var options = apply_options.hasOwnProperty(plugin_name) ? apply_options[plugin_name] : {};

                options = $.extend({}, jQueryPlugin._plugins[plugin_name].options, options);

                if (is_available(plugin_name, {container: container, target: target}, $.extend({}, options))) {
                    result.push({
                        plugin: plugin_name,
                        options: options,
                        target: target
                    });
                }
            }
        });

        return result;
    }

    /**
     * Check if a plugin is available
     * @param plugin
     * @param target_detail
     * @param options
     * @return {boolean|*}
     */
    function is_available(plugin, target_detail, options) {
        if (!$.isFunction(jQueryPlugin._plugins[plugin].available)) {
            return Boolean(jQueryPlugin._plugins[plugin].available);
        }

        return jQueryPlugin._plugins[plugin].available(target_detail, options);
    }

    /**
     *
     * @param {Array} small
     * @param {Array} large
     * @return {Array}
     */
    function array_intersection(small, large) {
        if (small.length > large.length) {
            return array_intersection(large, small);
        }

        var result = [];

        $.each(small, function (index, value) {
            if (-1 !== large.indexOf(value)) {
                result.push(value);
            }
        });

        return result;
    }

    /**
     *
     * @param {Array} array
     * @return {{}}
     */
    function array_flip(array) {
        var result = {};

        $.each(array, function (index, value) {
            if (typeof value === 'string' || $.isNumeric(value)) {
                result[value] = index;
            }
        });

        return result;
    }

    /**
     *
     * @param {string|{}} target selector or jQuery elements
     * @return {*} jQuery elements
     */
    function query(target) {
        var type = typeof target;
        if (type === 'function' || type === 'object' && !!target) {
            return target;
        }

        return $(target);
    }

})(jQuery, window, document);