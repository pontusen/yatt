var site = null,
    template = null,
    TorrentsModel = null,
    torrentCategories = null,
    sortWhiteList = ['title', 'seeders', 'leechers', 'size', 'created'],
    queryWhiteList = ['title', 'tags', 'categories', 'deadTorrents'],
    _ = require('underscore');


/**
 * @private
 */
function _getTorrents(req, res){
    var controller = new Controller(req, res);

    controller.sanitizeQuery().
        getModel().
        executeModel();
}

/**
 *
 * @param req
 * @param res
 * @constructor
 */
var Controller = function(req, res){
    this._req = req;
    this._res = res;
    this._model = null;
    this._modelCallbacks = {
        getTorrents: this._getTorrentsCallback.bind(this),
        getPages: this._buildPagesCallback.bind(this)
    };
};

/**
 * Saves only the whitelisted query keywords
 */
Controller.prototype.sanitizeQuery = function (){
    var newQuery = {},
        orderWhiteList = ['asc', 'desc'],
        nonAlfaNumericals = /[^\w|\s]/g,
        query = this._req.query;

    newQuery.sort = _.contains(sortWhiteList, query.sort) ?
        query.sort :
        null;

    newQuery.order = _.contains(orderWhiteList, query.order) ?
        query.order :
        null;

    //creates the object defining previous/next step for pager
    newQuery.offset = parseInt(query.offset);
    if(!_.isFinite(newQuery.offset) || newQuery.offset < 0){
        newQuery.offset = 0;
    }

    newQuery.criteria = _.pick(query, queryWhiteList);

    if(!_.isEmpty(newQuery.criteria.title)){ //remove any regex shenanigans
        newQuery.criteria.title = newQuery.criteria.title.replace(nonAlfaNumericals, '');
    }
    this._query = newQuery;
    return this;
};

/**
 *
 */
Controller.prototype.getModel = function(){
    this._model = new TorrentsModel(this._query);
    return this;
};

/**
 *
 */
Controller.prototype.executeModel = function(){
    this._model.
        registerCallbacks(this._modelCallbacks).
        trimCriteria().
        buildCriteria().
        buildSort().
        getTorrents();
    return this;
};

/**
 * Transforms the model's returned data into format suitable for the view.
 * @private
 */
Controller.prototype._getTorrentsCallback = function(alert, result){
    if(_.isObject(alert)){
        this._req.session.alert = alert;
        this._res.redirect('/torrents');
    }
    else{
        this._foundTorrents = result;
        this._model.getPages();
    }
};

/**
 * @private
 */
Controller.prototype._buildPagesCallback = function(alert, result){
    if(_.isObject(alert)){
        this._req.session.alert = alert;
        this._res.redirect('/torrents');
    }
    else{
        this._buildLinks(result).
            _buildLocals().
            _res.send(template(this._res.locals));
    }
};

/**
 * @private
 */
Controller.prototype._buildLinks = function(offsets){
    var searchString = '?',
        query = this._query,
        links = {};

    //sort part
    _.forEach(query.criteria, function(value, key){
        searchString = searchString + key + '=' + value + '&';
    });

    _.forEach(sortWhiteList, function(value){
        links[value] = searchString + 'sort=' + value;
    });

    if(!_.isEmpty(query.sort)){
        links[query.sort] += '&order=' + _getSortOrder(query.order);
    }

    //offset part
    if(_.isNumber(offsets.previous)){
        links.previous = {
            link: searchString + 'offset=' + offsets.previous,
            class: null
        };
    }
    else{
        links.previous = {
            link: null,
            class: 'disabled'
        };
    }

    if(_.isNumber(offsets.next)){
        links.next = {
            link: searchString + 'offset=' + offsets.next,
            class: null
        };
    }
    else{
        links.next = {
            link: null,
            class: 'disabled'
        };
    }
    this._links = links;
    return this;
};

/**
 * @private
 */
function _getSortOrder(order){
    return (!_.isEmpty(order) && _.isEqual(order, 'desc')) ?
        'asc' :
        'desc';
}

Controller.prototype._buildLocals = function(){
    var locals = this._res.locals;

    locals.query = this._query;
    locals.site = site;
    locals.lang.categories = torrentCategories[this._req.session.language];
    locals.links = this._links;
    locals.torrents = this._foundTorrents;
    return this;
};

/**
 * Sets up the routing for torrents listing
 * @param app the app to setup
 * @param jadeCompiler provide a compiler for jade templates
 * @returns {boolean}
 */
function setup(app, jadeCompiler){
    site = {
        name: app.config.site.name,
        categories: app.config.site.categories
    };
    template = jadeCompiler('torrents');
    TorrentsModel = require('./torrentsModel');
    torrentCategories = require('../../lib/internationalization')
        .getAdditionalLanguageField('torrentCategories');

    app.get('/torrents', _getTorrents);

    if(app.config.site.private){
        return app.config.site.ranks.MEMBER;
    }
    else{
        return app.config.site.ranks.PUBLIC;
    }
}

module.exports.setup = setup;
