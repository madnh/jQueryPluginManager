jQueryPlugin.register('pcolor', {
    handler: function (to, options) {
        $(to.target || to.container.find('p')).css({
            color: options.color
        });
    },
    options: {
        color: 'red'
    },
    selector: 'p',
    except_selector: '.except_me'
});

jQueryPlugin.register('bgcolor', {
    handler: function (to, options) {
        $(to.target || to.container.find('p')).css({
            backgroundColor: options.bgColor
        });
    },
    options: {
        bgColor: 'blue'
    },
    selector: 'p'
});