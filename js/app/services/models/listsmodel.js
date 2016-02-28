/**
 * ownCloud - Tasks
 *
 * @author Raimund Schlüßler
 * @copyright 2016 Raimund Schlüßler <raimund.schluessler@googlemail.com>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

(function() {
  var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  angular.module('Tasks').factory('ListsModel', [
	'TasksModel', '_Model', function(TasksModel, _Model) {
	  var ListsModel;
	  ListsModel = (function(_super) {
		__extends(ListsModel, _super);

		function ListsModel(_$tasksmodel) {
		  this._$tasksmodel = _$tasksmodel;
		  this._tmpUriCache = {};
		  this._data = [];
		  this._dataMap = {};
		  this._filterCache = {};
		}

		ListsModel.prototype.insert = function(cal) {
		  var access, calendar, component, components, href, name, owner, readWrite, share, shares, _i, _j, _len, _len1;
		  calendar = {
			id: this.size(),
			url: cal.url,
			enabled: cal.props['{http://owncloud.org/ns}calendar-enabled'] === '1',
			displayname: cal.props['{DAV:}displayname'] || 'Unnamed',
			color: cal.props['{http://apple.com/ns/ical/}calendar-color'] || '#1d2d44',
			order: parseInt(cal.props['{http://apple.com/ns/ical/}calendar-order']) || 0,
			components: {
			  vevent: false,
			  vjournal: false,
			  vtodo: false
			},
			writable: cal.props.canWrite,
			shareable: cal.props.canWrite,
			sharedWith: {
			  users: [],
			  groups: []
			},
			owner: ''
		  };
		  components = cal.props['{urn:ietf:params:xml:ns:caldav}' + 'supported-calendar-component-set'];
		  for (_i = 0, _len = components.length; _i < _len; _i++) {
			component = components[_i];
			name = component.attributes.getNamedItem('name').textContent.toLowerCase();
			if (calendar.components.hasOwnProperty(name)) {
			  calendar.components[name] = true;
			}
		  }
		  shares = cal.props['{http://owncloud.org/ns}invite'];
		  if (typeof shares !== 'undefined') {
			for (_j = 0, _len1 = shares.length; _j < _len1; _j++) {
			  share = shares[_j];
			  href = share.getElementsByTagNameNS('DAV:', 'href');
			  if (href.length === 0) {
				continue;
			  }
			  href = href[0].textContent;
			  access = share.getElementsByTagNameNS('http://owncloud.org/ns', 'access');
			  if (access.length === 0) {
				continue;
			  }
			  access = access[0];
			  readWrite = access.getElementsByTagNameNS('http://owncloud.org/ns', 'read-write');
			  readWrite = readWrite.length !== 0;
			  if (href.startsWith('principal:principals/users/')) {
				this.sharedWith.users.push({
				  id: href.substr(27),
				  displayname: href.substr(27),
				  writable: readWrite
				});
			  } else if (href.startsWith('principal:principals/groups/')) {
				this.sharedWith.groups.push({
				  id: href.substr(28),
				  displayname: href.substr(28),
				  writable: readWrite
				});
			  }
			}
		  }
		  owner = cal.props['{DAV:}owner'];
		  if (typeof owner !== 'undefined' && owner.length !== 0) {
			owner = owner[0].textContent.slice(0, -1);
			if (owner.startsWith('/remote.php/dav/principals/users/')) {
			  this.owner = owner.substr(33);
			}
		  }
		  this.add(calendar);
		  return calendar;
		};

		ListsModel.prototype.add = function(calendar, clearCache) {
		  var updateByUri;
		  if (clearCache == null) {
			clearCache = true;
		  }
		  updateByUri = angular.isDefined(calendar.uri) && angular.isDefined(this.getByUri(calendar.uri));
		  if (updateByUri) {
			return this.update(calendar, clearCache);
		  } else {
			if (angular.isDefined(calendar.uri)) {
			  if (clearCache) {
				this._invalidateCache();
			  }
			  if (angular.isDefined(this._dataMap[calendar.uri])) {

			  } else {
				this._data.push(calendar);
				return this._dataMap[calendar.uri] = calendar;
			  }
			}
		  }
		};

		ListsModel.prototype.getByUri = function(uri) {
		  return this._dataMap[uri];
		};

		ListsModel.prototype.update = function(list, clearCache) {
		  var tmplist;
		  if (clearCache == null) {
			clearCache = true;
		  }
		  tmplist = this._tmpIdCache[list.tmpID];
		  if (angular.isDefined(list.id) && angular.isDefined(tmplist) && angular.isUndefined(tmplist.id)) {
			tmplist.id = list.id;
			this._dataMap[list.id] = tmplist;
		  }
		  list["void"] = false;
		  return ListsModel.__super__.update.call(this, list, clearCache);
		};

		ListsModel.prototype["delete"] = function(calendar, clearCache) {
		  var counter, data, entry, _i, _len, _ref;
		  if (clearCache == null) {
			clearCache = true;
		  }
		  _ref = this._data;
		  for (counter = _i = 0, _len = _ref.length; _i < _len; counter = ++_i) {
			entry = _ref[counter];
			if (entry === calendar) {
			  this._data.splice(counter, 1);
			  data = this._dataMap[calendar.uri];
			  delete this._dataMap[calendar.uri];
			  if (clearCache) {
				this._invalidateCache();
			  }
			  return data;
			}
		  }
		};

		ListsModel.prototype.voidAll = function() {
		  var list, lists, _i, _len, _results;
		  lists = this.getAll();
		  _results = [];
		  for (_i = 0, _len = lists.length; _i < _len; _i++) {
			list = lists[_i];
			_results.push(list["void"] = true);
		  }
		  return _results;
		};

		ListsModel.prototype.removeVoid = function() {
		  var id, list, listIDs, lists, _i, _j, _len, _len1, _results;
		  lists = this.getAll();
		  listIDs = [];
		  for (_i = 0, _len = lists.length; _i < _len; _i++) {
			list = lists[_i];
			if (list["void"]) {
			  listIDs.push(list.id);
			}
		  }
		  _results = [];
		  for (_j = 0, _len1 = listIDs.length; _j < _len1; _j++) {
			id = listIDs[_j];
			_results.push(this.removeById(id));
		  }
		  return _results;
		};

		ListsModel.prototype.getStandardList = function() {
		  var calendars;
		  if (this.size()) {
			calendars = this.getAll();
			return calendars[0];
		  }
		};

		ListsModel.prototype.checkName = function(listName, listID) {
		  var list, lists, ret, _i, _len;
		  if (listID == null) {
			listID = void 0;
		  }
		  lists = this.getAll();
		  ret = true;
		  for (_i = 0, _len = lists.length; _i < _len; _i++) {
			list = lists[_i];
			if (list.displayname === listName && listID !== list.id) {
			  ret = false;
			}
		  }
		  return ret;
		};

		ListsModel.prototype.getCount = function(listID, collectionID, filter) {
		  var count, task, tasks, _i, _len;
		  if (filter == null) {
			filter = '';
		  }
		  count = 0;
		  tasks = this._$tasksmodel.filteredTasks(filter);
		  for (_i = 0, _len = tasks.length; _i < _len; _i++) {
			task = tasks[_i];
			count += this._$tasksmodel.filterTasks(task, collectionID) && task.calendarid === listID && !task.related;
		  }
		  if (collectionID === 'completed' && filter === '') {
			count += this.notLoaded(listID);
		  }
		  return count;
		};

		ListsModel.prototype.notLoaded = function(listID) {
		  if (angular.isUndefined(this.getById(listID))) {
			return 0;
		  } else {
			return this.getById(listID).notLoaded;
		  }
		};

		ListsModel.prototype.loadedAll = function(listID) {
		  return !this.notLoaded(listID);
		};

		ListsModel.prototype.getColor = function(listID) {
		  if (angular.isUndefined(this.getById(listID))) {
			return '#CCCCCC';
		  } else {
			return this.getById(listID).calendarcolor;
		  }
		};

		ListsModel.prototype.getName = function(listID) {
		  if (angular.isUndefined(this.getById(listID))) {
			return '';
		  } else {
			return this.getById(listID).displayname;
		  }
		};

		return ListsModel;

	  })(_Model);
	  return new ListsModel(TasksModel);
	}
  ]);

}).call(this);
