/*
 | Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
  "boilerplate",
  "boilerplate/ItemHelper",
  "boilerplate/UrlParamHelper",
  "dojo/i18n!./nls/resources",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/on",
  "dojo/Deferred",
  "put-selector/put",
  "dstore/Memory",
  "dstore/Trackable",
  "dgrid/OnDemandList",
  "dgrid/OnDemandGrid",
  "dgrid/Selection",
  "dgrid/extensions/ColumnHider",
  "dgrid/extensions/DijitRegistry",
  "dojo/dom",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dijit/registry",
  "dijit/form/TextBox",
  "esri/portal/Portal",
  "esri/portal/PortalItem",
  "esri/portal/PortalQueryParams"
], function (Boilerplate, ItemHelper, UrlParamHelper, i18n,
             declare, lang, array, on, Deferred, put,
             Memory, Trackable, OnDemandList, OnDemandGrid, Selection, ColumnHider, DijitRegistry,
             dom, domAttr, domClass, registry, TextBox,
             Portal, PortalItem, PortalQueryParams) {

  // CSS //
  var CSS = {
    loading: "boilerplate--loading",
    error: "boilerplate--error",
    errorIcon: "esri-icon-notice-round"
  };

  // TRACKABLE MEMORY STORE //
  var TrackableMemory = declare([Memory, Trackable]);

  // MAIN APPLICATION //
  return Boilerplate.createSubclass({

    /**
     *  CONSTRUCTOR
     */
    constructor: function () {
      this.always(this.init.bind(this));
    },

    /**
     * INITIALIZE APPLICATION
     */
    init: function () {

      // SET LOCALE AND DIRECTION //
      this._setLocaleAndDirection();

      // HELPERS //
      this.urlParamHelper = new UrlParamHelper();
      this.itemHelper = new ItemHelper();

      if(this.results.webMapItem) {
        // LOAD WEB MAP //
        this._createView(this.results.webMapItem).then(this.applicationReady.bind(this));
      } else if(this.results.webSceneItem) {
        // LOAD WEB SCENE //
        this._createView(this.results.webSceneItem).then(this.applicationReady.bind(this));
      } else if(this.results.group) {
        // LOAD GROUP GALLERY //
        this._createGroupGallery(this.results.group);
      } else {
        // ERROR //
        this.reportError(new Error("main:: Could not load an item to display"));
      }

    },

    /**
     *
     * @param error
     * @returns {*}
     */
    reportError: function (error) {
      // remove loading class from body
      domClass.remove(document.body, CSS.loading);
      domClass.add(document.body, CSS.error);
      // an error occurred - notify the user. In this example we pull the string from the
      // resource.js file located in the nls folder because we've set the application up
      // for localization. If you don't need to support multiple languages you can hardcode the
      // strings here and comment out the call in index.html to get the localization strings.
      // set message
      var node = dom.byId("loading_message");
      if(node) {
        node.innerHTML = "<h1><span class=\"" + CSS.errorIcon + "\"></span> " + i18n.error + "</h1><p>" + error.message + "</p>";
      }
      return error;
    },

    /**
     * SET LOCALE AND DIRECTION
     *
     * @private
     */
    _setLocaleAndDirection: function () {
      // LOCALE //
      document.documentElement.lang = this.locale;
      // DIRECTION //
      var direction = this.direction;
      var dirNode = document.getElementsByTagName("html")[0];
      domAttr.set(dirNode, "dir", direction);
    },

    /**
     *
     * @param item
     * @private
     */
    _createView: function (item) {
      var deferred = new Deferred();

      // ITEM TYPE //
      var type = item.data.type.replace(/Web /, "");
      var actionType = lang.replace("createWeb{type}", { type: type });
      var viewType = lang.replace("esri/views/{type}View", { type: type });
      var settingType = lang.replace("web{type}", { type: type.toLowerCase() });

      // CREATE MAP //
      this.itemHelper[actionType](item).then(function (map) {

        // APP TITLE //
        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }

        // GET VIEW //
        require([viewType], function (MapOrSceneView) {

          // VIEW PROPERTIES //
          var viewProperties = lang.mixin({
            map: map,
            container: this.settings[settingType].containerId
          }, this.urlParamHelper.getViewProperties(this.config));

          // CREATE VIEW //
          var view = new MapOrSceneView(viewProperties);
          view.then(function (response) {
            this.urlParamHelper.addToView(view, this.config);

            // UPDATE TITLE //
            dom.byId("app-title").innerHTML = document.title = this.config.title;
            registry.byId("main-container").layout();

            // APP IS READY //
            domClass.remove(document.body, CSS.loading);
            deferred.resolve({ map: map, view: view });

          }.bind(this), this.reportError);
        }.bind(this));
      }.bind(this), this.reportError);

      return deferred.promise;
    },

    /**
     * CREATE GALLERY OF GROUP ITEMS
     *
     * @param groupData
     * @private
     */
    _createGroupGallery: function (groupData) {
      var groupInfoData = groupData.infoData;
      var groupItemsData = groupData.itemsData;
      if(!groupInfoData || !groupItemsData || groupInfoData.total === 0 || groupInfoData instanceof Error) {
        this.reportError(new Error("main:: group info or group data does not exist."));
        return;
      }

      // GROUP INFO //
      this.groupInfo = groupInfoData.results[0];

      // DETAILS //
      var infoNode = dom.byId("details-node");
      put(infoNode, "div.info-node span.info-label $ <span.info-value $", "User:", lang.replace("{firstName} {lastName}", this.portal.user));
      put(infoNode, "div.info-node span.info-label $ <span.info-value $", "Portal: ", this.portal.name);
      put(infoNode, "div.info-node span.info-label $ <span.info-value $", "Group: ", this.groupInfo.title);

      // TOTAL ITEM COUNT //
      this.itemTotal = groupItemsData.total;
      this.itemCountNode = put(infoNode, "div.info-node");
      this.itemCountLabelNode = put(this.itemCountNode, "span.info-label $ <span.info-value", "Items: ");

      // FETCH ALL //
      if(groupItemsData.results.length < groupItemsData.total) {
        this.fetchAllNode = put(this.itemCountNode, "span.info-fetch-all", { innerHTML: "Fetch All", title: "Retrieve all remaining items in this group..." });
        on(this.fetchAllNode, "click", function () {
          this.getItems(groupItemsData.nextQueryParams, true);
        }.bind(this));
      }

      // FILTER ITEMS //
      var textFilterNode = dom.byId("text-filter-input-node");
      var filterInputNode = put(textFilterNode, "div.info-node span");
      var filterInput = new TextBox({
        style: "width:100%;padding:2px;color:#0079c1;",
        value: this.config.itemTextFilter,
        placeHolder: "...text filter...",
        title: "Filter based on the title, summary, description, and tags (exact match).",
        intermediateChanges: true,
        onChange: function (filter) {
          this.itemTextFilter = filter;
          this.applyFilter();
        }.bind(this)
      }, put(filterInputNode, "span"));
      // CLEAR TEXT FILTER //
      var clearTextFilterNode = dom.byId("clear-text-filter");
      on(clearTextFilterNode, "click", function () {
        filterInput.set("value", null);
      });
      // FILTER COUNT //
      this.filterCountNode = put(textFilterNode, "div.info-node.info-filter-count");

      // ITEM STORE //
      this.itemStore = new TrackableMemory({ data: [] });
      // TRACK STORE UPDATES //
      this.itemStoreTrack = this.itemStore.track();
      this.itemStoreTrack.on("add", function () {
        if(this.itemStore.data.length < this.itemTotal) {
          this.itemCountLabelNode.innerHTML = lang.replace("{count} of {total}", {
            count: this.itemStore.data.length,
            total: this.itemTotal
          });
        } else {
          this.itemCountLabelNode.innerHTML = this.itemTotal;
          domClass.add(this.fetchAllNode, "dijitHidden");
        }
        this.applyFilter();
      }.bind(this));

      // ITEM COLUMNS //
      this.itemColumns = this.getItemColumns();

      // ITEM LIST //
      this.itemList = new (declare([OnDemandGrid, ColumnHider, DijitRegistry]))({
        loadingMessage: "Loading Items...",
        noDataMessage: "No Items",
        collection: this.itemStore,
        columns: this.itemColumns,
        sort: "title"
      }, "item-list-node");
      // ITEM SELECTED //
      this.itemList.on(".dgrid-row:click", function (evt) {
        // ITEM //
        var item = this.itemList.row(evt).data;
        // ITEM DETAILS PAGE URL //
        var itemDetailsPageUrl = lang.replace("{protocol}//{urlKey}.{customBaseUrl}/home/item.html?id={itemId}", {
          protocol: document.location.protocol,
          urlKey: this.portal.urlKey,
          customBaseUrl: this.portal.customBaseUrl,
          itemId: item.id
        });
        // OPEN ITEM DEATILS PAGE //
        window.open(itemDetailsPageUrl);
      }.bind(this));
      this.itemList.startup();

      // LIST UPDATED
      this.itemList.on("dgrid-refresh-complete", function (evt) {
        this.filterCountNode.innerHTML = lang.replace("{count} of {total}", {
          count: evt.grid._total,
          total: this.itemStore.data.length
        });
      }.bind(this));

      // ADD ITEMS TO LIST //
      this.addItemsToList(groupItemsData, false);

      // CREATE ITEM TYPE FILTER //
      this.updateTypeFilter();

      // CLEAR LOADING //
      domClass.remove(document.body, CSS.loading);

    },

    /**
     * ADD ITEMS TO LIST ONCE IT'S READY
     *
     * @param queryResponse
     * @param fetchAll
     */
    addItemsToList: function (queryResponse, fetchAll) {

      // MAKE SURE EACH ITEM IS READY BEFORE ADDING TO STORE //
      array.forEach(queryResponse.results, function (item) {
        item.then(function () {
          this.itemStore.add(item);
        }.bind(this));
      }.bind(this));

      // GET MORE ITEMS IF AVAILABLE //
      if(queryResponse.nextQueryParams.start > -1) {
        if(fetchAll) {
          this.getItems(queryResponse.nextQueryParams, true);
        }
      } else {
        // UPDATE ITEM TYPE FILTER //
        this.updateTypeFilter();
      }

    },

    /**
     * GET ITEMS AND ADD TO STORE/LIST
     *
     * @param queryParameters
     * @param fetchAll
     */
    getItems: function (queryParameters, fetchAll) {
      this.portal.queryItems(queryParameters).then(function (response) {
        this.addItemsToList(response, fetchAll);
      }.bind(this));
    },

    /**
     * ITEM COLUMNS
     *
     * @returns {Array}
     */
    getItemColumns: function () {
      var columns = [];
      columns.push({
        label: "Thumbnail",
        field: "thumbnailUrl",
        hidden: !this.config.column_thumbnailUrl,
        renderCell: this.renderItemThumbnail
      });
      columns.push({
        label: "Title",
        field: "title",
        hidden: !this.config.column_title,
        renderCell: this.renderItemTitle
      });
      columns.push({
        label: "ID",
        field: "id",
        hidden: !this.config.column_id
      });
      columns.push({
        label: "Credits",
        field: "accessInformation",
        hidden: !this.config.column_accessInformation
      });
      columns.push({
        label: "Access",
        field: "licenseInfo",
        hidden: !this.config.column_licenseInfo,
        renderCell: this.renderItemAccess
      });
      columns.push({
        label: "Shared",
        field: "access",
        hidden: !this.config.column_access
      });
      columns.push({
        label: "Summary",
        field: "snippet",
        hidden: !this.config.column_snippet
      });
      columns.push({
        label: "Description",
        field: "description",
        hidden: !this.config.column_description,
        renderCell: this.renderItemDescription
      });
      columns.push({
        label: "Type",
        field: "type",
        hidden: !this.config.column_type
      });
      columns.push({
        label: "Type Keywords",
        field: "typeKeywords",
        hidden: !this.config.column_typeKeywords
      });
      columns.push({
        label: "Tags",
        field: "tags",
        canSort: false,
        hidden: !this.config.column_tags
      });
      columns.push({
        label: "Created",
        field: "created",
        hidden: !this.config.column_created,
        formatter: this.formatDateValue
      });
      columns.push({
        label: "Modified",
        field: "modified",
        hidden: !this.config.column_modified,
        formatter: this.formatDateValue
      });
      columns.push({
        label: "Owner",
        field: "owner",
        hidden: !this.config.column_owner
      });
      columns.push({
        label: "Avg Rating",
        field: "avgRating",
        hidden: !this.config.column_avgRating
      });
      columns.push({
        label: "Num Ratings",
        field: "numRatings",
        hidden: !this.config.column_numRatings
      });
      columns.push({
        label: "Num Views",
        field: "numViews",
        hidden: !this.config.column_numViews
      });
      columns.push({
        label: "Num Comments",
        field: "numComments",
        hidden: !this.config.column_numComments
      });

      return columns;
    },

    renderItemTitle: function (object, value, node, options) {
      return put("div.item-title", value || "[No Title]");
    },

    renderItemDescription: function (object, value, node, options) {
      domClass.toggle(node, "item-has-value", (value != null));
      return put("div.item-as-html", { innerHTML: value || "[empty]" });
    },

    renderItemAccess: function (object, value, node, options) {
      domClass.toggle(node, "item-has-value", (value != null));
      return put("div.item-as-html", { innerHTML: value || "[empty]" });
    },

    renderItemThumbnail: function (object, value, node, options) {
      return put("img.item-thumbnail", { src: value || "./images/no_preview.gif" });
    },

    formatDateValue: function (value) {
      return (new Date(value)).toLocaleString();
    },

    /**
     * ITEM TYPE FILTER
     */
    updateTypeFilter: function () {

      if(!this.itemTypes) {

        // STORE OF ITEM TYPES //
        this.itemTypes = new TrackableMemory({ data: [] });

        // LIST OF ITEM TYPES //
        this.itemTypeList = new (declare([OnDemandList, Selection]))({
          className: "dgrid-autoheight",
          selectionMode: "single",
          loadingMessage: "Loading Items Types...",
          noDataMessage: "No Item Types",
          collection: this.itemTypes,
          renderRow: function (itemType, options) {
            return put("div.item-type", itemType.label);
          }
        }, "item-type-list-node");
        // ITEM TYPE SELECTED //
        this.itemTypeList.on("dgrid-select", function (evt) {
          this.itemType = evt.rows[0].data;
          this.applyFilter();
        }.bind(this));
        this.itemTypeList.on("dgrid-deselect", function (evt) {
          this.itemType = null;
          this.applyFilter();
        }.bind(this));
        this.itemTypeList.startup();

        // CLEAR TYPE FILTER //
        on(dom.byId("clear-type-filter"), "click", function () {
          this.itemTypeList.clearSelection();
        }.bind(this));

      }

      // POPULATE UNIQUE LIST OF ITEM TYPES //
      this.itemStore.fetch().forEach(function (item) {
        var itemType = this.itemTypes.getSync(item.type);
        if(!itemType) {
          this.itemTypes.add({
            id: item.type,
            label: item.type
          });
        }
      }.bind(this));

    },

    /**
     *
     */
    applyFilter: function () {

      var filteredItems = this.itemStore;
      var itemStoreFilter = new this.itemStore.Filter();

      // ITEM TYPE FILTER //
      if(this.itemType) {
        var itemTypeFilter = itemStoreFilter.eq("type", this.itemType.label);
        filteredItems = filteredItems.filter(itemTypeFilter);
      }

      // TEXT FILTER //
      if(this.itemTextFilter) {
        var itemFilterRegExp = new RegExp(this.itemTextFilter, "i");

        var titleFilter = itemStoreFilter.match("title", itemFilterRegExp);
        var snippetFilter = itemStoreFilter.match("snippet", itemFilterRegExp);
        var descriptionFilter = itemStoreFilter.match("description", itemFilterRegExp);
        var tagFilter = itemStoreFilter.contains("tags", [this.itemTextFilter]);

        filteredItems = filteredItems.filter(titleFilter.or(snippetFilter).or(descriptionFilter).or(tagFilter));
      }

      // UPDATE LIST //
      this.itemList.set("collection", filteredItems);

    },

    /**
     * THE APPLICATION IS READY
     *
     */
    applicationReady: function () {
      console.info("Application Ready: ");
    }

  });
});