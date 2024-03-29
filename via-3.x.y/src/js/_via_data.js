/**
 *
 * @class
 * @classdesc Manages the storage and update of all data (annotations, files, etc. )
 * @author Abhishek Dutta <adutta@robots.ox.ac.uk>
 * @date 31 Dec. 2018
 *
 */

'use strict';

function _via_data() {
  this.store = this._init_default_project();
  this.file_ref = {};        // ref. to files selected using browser's file selector
  this.file_object_uri = {}; // WARNING: cleanup using file_object_url[fid]._destroy_file_object_url()

  this.DATA_FORMAT_VERSION = '3.1.1';

  // registers on_event(), emit_event(), ... methods from
  // _via_event to let this module listen and emit events
  this._EVENT_ID_PREFIX = '_via_data_';
  _via_event.call(this);
}

_via_data.prototype._init_default_project = function() {
  var p = {};
  p['project'] = {
    'pid': '__VIA_PROJECT_ID__',
    'rev': '__VIA_PROJECT_REV_ID__',
    'rev_timestamp': '__VIA_PROJECT_REV_TIMESTAMP__',
    'pname': 'Default Project',
    'data_format_version': this.DATA_FORMAT_VERSION,
    'creator': 'VGG Image Annotator (http://www.robots.ox.ac.uk/~vgg/software/via)',
    'created': Date.now(),
    'vid_list': [],
  }
  p['config'] = {
    'file': {
      'loc_prefix': { '1':'', '2':'', '3':'', '4':'' }, // constants defined in _via_file._VIA_FILE_LOC
    },
    'ui': {
      'file_content_align':'center',
    },
  };
  p['attribute'] = {};
  p['file'] = {};
  p['metadata'] = {};
  p['view'] = {};

  this.cache = {};
  this.cache['mid_list'] = {};
  this.cache['attribute_group'] = {};

  return p;
}

//
// attribute
//
_via_data.prototype._attribute_get_new_id = function() {
  var aid_list = Object.keys(this.store.attribute).map(Number).sort();
  var n = aid_list.length;
  var aid;
  if ( n ) {
    aid = aid_list[n-1] + 1;
  } else {
    aid = 1;
  }
  return aid;
}

_via_data.prototype._attribute_exist = function(aname) {
  var aid;
  for ( aid in this.store['attribute'] ) {
    if ( this.store['attribute'][aid].aname === aname ) {
      return true;
    }
  }
  return false;
}

_via_data.prototype.attribute_add = function(name, anchor_id, type, desc, options, default_option_id) {
  return new Promise( function(ok_callback, err_callback) {
    if ( this._attribute_exist(name) ) {
      err_callback('attribute already exists');
      return;
    }

    var aid = this._attribute_get_new_id();
    var desc = desc || '';
    var options = options || {};
    var default_option_id = default_option_id || '';
    this.store['attribute'][aid] = new _via_attribute(name,
                                                      anchor_id,
                                                      type,
                                                      desc,
                                                      options,
                                                      default_option_id);
    this._cache_update_attribute_group();
    this.emit_event( 'attribute_add', { 'aid':aid } );
    ok_callback(aid);
  }.bind(this));
}

_via_data.prototype.attribute_del = function(aid) {
  return new Promise( function(ok_callback, err_callback) {
    if ( this._attribute_exist(name) ) {
      err_callback('attribute already exists');
      return;
    }

    // delete all metadata entries for aid
    for ( var mid in this.store.metadata ) {
      if ( this.store.metadata[mid].av.hasOwnProperty(aid) ) {
        delete this.store.metadata[mid].av[aid];
      }
    }

    // delete aid
    delete this.store.attribute[aid];
    this._cache_update_attribute_group();
    this.emit_event( 'attribute_del', { 'aid':aid } );
    ok_callback(aid);
  }.bind(this));
}


_via_data.prototype.attribute_update_anchor_id = function(aid, anchor_id) {
  return new Promise( function(ok_callback, err_callback) {
    if ( ! this.store.attribute.hasOwnProperty(aid) ) {
      err_callback('aid does not exist');
      return;
    }
    this.store.attribute[aid].anchor_id = anchor_id;
    this._cache_update_attribute_group();
    this.emit_event( 'attribute_update', { 'aid':aid } );
    ok_callback(aid);
  }.bind(this));
}

_via_data.prototype.attribute_anchor_value_to_name = function(anchor_value) {
  for ( var anchor_name in _VIA_ATTRIBUTE_ANCHOR ) {
    if ( _via_util_array_eq(_VIA_ATTRIBUTE_ANCHOR[anchor_name], anchor_value) ) {
      return anchor_name;
    }
  }
  return '';
}

_via_data.prototype.attribute_update_aname = function(aid, new_aname) {
  return new Promise( function(ok_callback, err_callback) {
    if ( ! this.store.attribute.hasOwnProperty(aid) ) {
      err_callback('aid does not exist');
      return;
    }
    this.store['attribute'][aid]['aname'] = new_aname;
    this.emit_event( 'attribute_update', { 'aid':aid, 'aname':new_aname } );
    ok_callback(aid);
  }.bind(this));
}

_via_data.prototype.attribute_update_type = function(aid, new_type) {
  return new Promise( function(ok_callback, err_callback) {
    if ( ! this.store.attribute.hasOwnProperty(aid) ) {
      err_callback('aid does not exist');
      return;
    }
    this.store['attribute'][aid]['type'] = new_type;
    console.log(JSON.stringify(this.store.attribute[aid]))
    this.emit_event( 'attribute_update', { 'aid':aid, 'type':new_type } );
    ok_callback(aid);
  }.bind(this));
}

// option_csv = option1,*default_option,option2,...
_via_data.prototype.attribute_update_options_from_csv = function(aid, options_csv) {
  return new Promise( function(ok_callback, err_callback) {
    if ( ! this.store.attribute.hasOwnProperty(aid) ) {
      err_callback('aid does not exist');
      return;
    }
    options_csv = options_csv.trim();
    this.store['attribute'][aid]['options'] = {};
    this.store['attribute'][aid]['default_option_id'] = '';
    var options = options_csv.split(',');
    for ( var oid = 0; oid < options.length; ++oid ) {
      var oval = options[oid];
      oval = oval.trim();
      if ( oval.startsWith('*') ) {
        this.store['attribute'][aid]['default_option_id'] = oid.toString();
        oval = oval.substring(1); // remove *
      }
      this.store['attribute'][aid]['options'][oid] = oval;
    }
    this.emit_event( 'attribute_update', { 'aid':aid } );
    ok_callback(aid);
  }.bind(this));
}

//
// file
//
_via_data.prototype._file_get_new_id = function() {
  var fid;
  var fid_list = Object.keys(this.store.file).map(Number).sort();
  var n = fid_list.length;
  if ( n ) {
    fid = fid_list[n-1] + 1;
  } else {
    fid = 1;
  }
  return fid;
}

_via_data.prototype.file_add = function(name, type, loc, src) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      var fid = this._file_get_new_id();
      this.store.file[fid] = new _via_file(fid, name, type, loc, src);
      this.emit_event( 'file_add', { 'fid':fid } );
      ok_callback(fid);
    }
    catch(ex) {
      err_callback(ex);
    }
  }.bind(this));
}


_via_data.prototype.file_update = function(fid, name, value) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( this.store.file.hasOwnProperty(fid) ) {
        if ( name === 'src' ) {
          if ( this.store.file[fid].loc === _VIA_FILE_LOC.LOCAL ) {
            this.file_ref[fid] = value;
            this.store.file[fid]['src'] = '';
          } else {
            this.store.file[fid]['src'] = value;
          }
        } else {
          if ( name === 'loc_prefix' ) {
            this.store.config.file.loc_prefix[this.store.file[fid].loc] = value;
          } else {
            this.store.file[fid][name] = value;
          }
        }
        this.emit_event( 'file_update', { 'fid':fid } );
        ok_callback(fid);
      } else {
        err_callback('fid=' + fid + ' does not exist!');
      }
    }
    catch(ex) {
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.file_get_src = function(fid) {
  if ( this.store.file[fid].loc === _VIA_FILE_LOC.LOCAL ) {
    this.file_free_resources(fid);
    if ( this.file_ref.hasOwnProperty(fid) ) {
      this.file_object_uri[fid] = URL.createObjectURL( this.file_ref[fid] );
    } else {
      this.file_object_uri[fid] = '';
    }
    return this.file_object_uri[fid];
  } else {
    return this.store.config.file.loc_prefix[ this.store.file[fid].loc ] + this.store.file[fid].src;
  }
}

_via_data.prototype.file_get_uri = function(fid) {
  if ( this.store.file[fid].loc === _VIA_FILE_LOC.LOCAL ) {
    return this.store.file[fid].fname;
  } else {
    return this.store.config.file.loc_prefix[ this.store.file[fid].loc ] + this.store.file[fid].src;
  }
}

_via_data.prototype.file_free_resources = function(fid) {
  if ( this.file_object_uri.hasOwnProperty(fid) ) {
    URL.revokeObjectURL( this.file_object_uri[fid] );
    delete this.file_object_uri[fid];
  }
}

//
// Metadata
//
_via_data.prototype._metadata_get_new_id = function(vid) {
  return vid + '_' + _via_util_uid6();
}

_via_data.prototype.metadata_add = function(vid, z, xy, av) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( ! this.store['view'].hasOwnProperty(vid) ) {
        err_callback({'vid':vid});
        return;
      }
      var mid = this._metadata_get_new_id(vid);
      var z_fp = _via_util_float_arr_to_fixed(z, _VIA_FLOAT_FIXED_POINT);
      var xy_fp = _via_util_float_arr_to_fixed(xy, _VIA_FLOAT_FIXED_POINT);
      this.store.metadata[mid] = new _via_metadata(vid, z_fp, xy_fp, av);
      if ( ! this.cache.mid_list.hasOwnProperty(vid) ) {
        this.cache.mid_list[vid] = [];
      }
      this.cache.mid_list[vid].push(mid);

      this.emit_event( 'metadata_add', { 'vid':vid, 'mid':mid } );
      ok_callback( {'vid':vid, 'mid':mid} );
    }
    catch(ex) {
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.metadata_add_bulk = function(metadata_list, emit) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      var added_mid_list = [];
      for ( var mindex in metadata_list ) {
        var vid = metadata_list[mindex].vid;
        var mid = this._metadata_get_new_id(vid);
        var z_fp = _via_util_float_arr_to_fixed(metadata_list[mindex].z, _VIA_FLOAT_FIXED_POINT);
        var xy_fp = _via_util_float_arr_to_fixed(metadata_list[mindex].xy, _VIA_FLOAT_FIXED_POINT);
        this.store.metadata[mid] = new _via_metadata(vid, z_fp, xy_fp, metadata_list[mindex].av);
        if ( ! this.cache.mid_list.hasOwnProperty(vid) ) {
          this.cache.mid_list[vid] = [];
        }
        this.cache.mid_list[vid].push(mid);
        added_mid_list.push(mid);
      }
      if ( typeof(emit) !== 'undefined' &&
           emit === true ) {
        this.emit_event( 'metadata_add_bulk', { 'mid_list':added_mid_list } );
      }
      ok_callback( { 'mid_list':added_mid_list } );
    }
    catch(ex) {
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.metadata_update = function(vid, mid, z, xy, v) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( ! this.store.view.hasOwnProperty(vid) ) {
        err_callback({'vid':vid});
        return;
      }

      if ( ! this.store.metadata.hasOwnProperty(mid) ) {
        err_callback({'mid':mid});
        return;
      }

      var z_fp = _via_util_float_arr_to_fixed(z, _VIA_FLOAT_FIXED_POINT);
      var xy_fp = _via_util_float_arr_to_fixed(xy, _VIA_FLOAT_FIXED_POINT);
      this.store.metadata[mid] = new _via_metadata(vid, z_fp, xy_fp, av);
      this.emit_event( 'metadata_update', { 'vid':vid, 'mid':mid } );
      ok_callback({'vid':vid, 'mid':mid});
    }
    catch(ex) {
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.metadata_update_xy = function(vid, mid, xy) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( ! this.store.view.hasOwnProperty(vid) ) {
        err_callback({'vid':vid});
        return;
      }
      if ( ! this.store.metadata.hasOwnProperty(mid) ) {
        err_callback({'mid':mid});
        return;
      }
      var xy_fp = _via_util_float_arr_to_fixed(xy, _VIA_FLOAT_FIXED_POINT);
      this.store.metadata[mid].xy = xy_fp;
      this.emit_event( 'metadata_update', { 'vid':vid, 'mid':mid } );
      ok_callback({'vid':vid, 'mid':mid});
    }
    catch(ex) {
      console.log(xy);
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.metadata_update_av = function(vid, mid, aid, avalue) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( ! this.store.view.hasOwnProperty(vid) ) {
        err_callback({'vid':vid});
        return;
      }
      if ( ! this.store.metadata.hasOwnProperty(mid) ) {
        err_callback({'mid':mid});
        return;
      }

      this.store.metadata[mid].av[aid] = avalue;
      this.emit_event( 'metadata_update', { 'vid':vid, 'mid':mid } );
      ok_callback({'vid':vid, 'mid':mid});
    }
    catch(ex) {
      console.log(ex);
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.metadata_update_av_bulk = function(vid, av_list) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( ! this.store.view.hasOwnProperty(vid) ) {
        err_callback({'vid':vid});
        return;
      }
      var updated_mid_list = [];
      var mid, aid, avalue;
      for ( var i in av_list ) {
        mid = av_list[i].mid;
        aid = av_list[i].aid;
        avalue = av_list[i].avalue;
        this.store.metadata[mid].av[aid] = avalue;
        updated_mid_list.push(mid);
      }
      var event_payload = { 'vid':vid, 'mid_list':updated_mid_list };
      this.emit_event('metadata_update_bulk', event_payload);
      ok_callback(event_payload);
    }
    catch(ex) {
      console.log(ex);
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.metadata_update_z = function(vid, mid, z) {
  return new Promise( function(ok_callback, err_callback) {
    if ( ! this.store.view.hasOwnProperty(vid) ) {
      err_callback({'vid':vid});
      return;
    }
    if ( ! this.store.metadata.hasOwnProperty(mid) ) {
      err_callback({'mid':mid});
      return;
    }

    var z_fp = _via_util_float_arr_to_fixed(z, _VIA_FLOAT_FIXED_POINT);
    this.store.metadata[mid].z = z_fp;
    this.emit_event( 'metadata_update', { 'vid':vid, 'mid':mid } );
    ok_callback({'vid':vid, 'mid':mid});
  }.bind(this));
}

_via_data.prototype.metadata_update_zi = function(vid, mid, zindex, zvalue) {
  return new Promise( function(ok_callback, err_callback) {
    if ( ! this.store.view.hasOwnProperty(vid) ) {
      err_callback({'vid':vid});
      return;
    }
    if ( ! this.store.metadata.hasOwnProperty(mid) ) {
      err_callback({'mid':mid});
      return;
    }

    var zvalue_fp = _via_util_float_to_fixed(zvalue, _VIA_FLOAT_FIXED_POINT);
    this.store.metadata[mid].z[zindex] = zvalue_fp;
    this.emit_event( 'metadata_update', { 'vid':vid, 'mid':mid } );
    ok_callback({'vid':vid, 'mid':mid});
  }.bind(this));
}


_via_data.prototype.metadata_delete = function(vid, mid) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( ! this.store.view.hasOwnProperty(vid) ) {
        err_callback({'vid':vid});
        return;
      }
      if ( ! this.store.metadata.hasOwnProperty(mid) ) {
        err_callback({'mid':mid});
        return;
      }

      this._cache_mid_list_del(vid, [mid]);
      delete this.store.metadata[mid];
      this.emit_event( 'metadata_delete', { 'vid':vid, 'mid':mid } );
      ok_callback({'vid':vid, 'mid':mid});
    }
    catch(ex) {
      console.log(xy);
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.metadata_delete_bulk = function(vid, mid_list, emit) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( ! this.store.view.hasOwnProperty(vid) ) {
        err_callback({'vid':vid});
        return;
      }
      var deleted_mid_list = [];
      var mid, cindex;
      for ( var mindex in mid_list ) {
        mid = mid_list[mindex];
        delete this.store.metadata[mid];
        deleted_mid_list.push(mid);
      }
      this._cache_mid_list_del(vid, deleted_mid_list);
      if ( typeof(emit) !== 'undefined' &&
           emit === true ) {
        this.emit_event( 'metadata_delete_bulk', { 'vid':vid, 'mid_list':deleted_mid_list } );
      }
      ok_callback({'vid':vid, 'mid_list':deleted_mid_list});
    }
    catch(ex) {
      console.log(ex);
      err_callback(ex);
    }
  }.bind(this));
}

//
// View
//
_via_data.prototype._view_get_new_id = function() {
  var vid;
  var vid_list = Object.keys(this.store.view).map(Number).sort();
  var n = vid_list.length;
  if ( n ) {
    vid = (vid_list[n-1] + 1).toString();
  } else {
    vid = '1';
  }
  return vid;
}

_via_data.prototype.view_add = function(fid_list) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      var vid = this._view_get_new_id();
      this.store.view[vid] = new _via_view(fid_list);
      this.store.project.vid_list.push(vid);
      this.emit_event( 'view_add', { 'vid':vid } );
      ok_callback(vid);
    }
    catch(ex) {
      console.log(ex)
      err_callback(ex);
    }
  }.bind(this));
}

_via_data.prototype.view_get_file_vid = function(fid) {
  for ( var vid in this.store.view ) {
    if ( _via_util_array_eq(this.store.view[vid].fid_list, [fid]) ) {
      return vid;
    }
  }
  return -1;
}

// add view with single file
_via_data.prototype.view_bulk_add_from_filelist = function(filelist) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      var added_fid_list = [];
      var added_vid_list = [];
      for ( var i = 0; i < filelist.length; ++i ) {
        var fid = this._file_get_new_id();
        if ( filelist[i].loc === _VIA_FILE_LOC.LOCAL ) {
          this.file_ref[fid] = filelist[i].src; // local file ref. stored separately
          filelist[i].src = '';                 // no need to store duplicate of file ref.
        }
        this.store.file[fid] = new _via_file(fid,
                                             filelist[i].fname,
                                             filelist[i].type,
                                             filelist[i].loc,
                                             filelist[i].src);

        var vid = this._view_get_new_id();
        this.store.view[vid] = new _via_view( [ fid ] ); // view with single file
        this.store.project.vid_list.push(vid);

        added_fid_list.push(fid);
        added_vid_list.push(vid);
      }
      var payload = { 'vid_list':added_vid_list, 'fid_list':added_fid_list };
      this.emit_event( 'view_bulk_add', payload );
      ok_callback(payload);
    }
    catch(err) {
      err_callback(err);
    }
  }.bind(this));
}

_via_data.prototype.view_del = function(vid) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      if ( ! this.store.view.hasOwnProperty(vid) ) {
        err_callback();
        return;
      }
      var vindex = this.store.project.vid_list.indexOf(vid);
      if ( vindex === -1 ) {
        err_callback();
        return;
      }

      // delete all metadata
      var mid;
      for ( var mindex in this.cache.mid_list[vid] ) {
        mid = this.cache.mid_list[vid][mindex];
        delete this.store.metadata[mid];
      }
      // delete all files
      var fid;
      for ( var findex in this.store.view[vid].fid_list ) {
        fid = this.store.view[vid].fid_list[findex];
        delete this.store.file[fid];
      }
      // delete view
      delete this.store.view[vid];
      this.store.project.vid_list.splice(vindex, 1);

      this._cache_update_mid_list();
      this.emit_event( 'view_del', {'vid':vid, 'vindex':vindex} );
      ok_callback({'vid':vid, 'vindex':vindex});
    }
    catch(err) {
      err_callback(err);
    }
  }.bind(this));
}

//
// cache
//
_via_data.prototype._cache_update = function() {
  this._cache_update_mid_list();
  this._cache_update_attribute_group();
}

_via_data.prototype._cache_mid_list_del = function(vid, del_mid_list) {
  var mid;
  for ( var mindex in del_mid_list ) {
    mid = del_mid_list[mindex];
    var cindex = this.cache.mid_list[vid].indexOf(mid);
    if ( cindex !== -1 ) {
      this.cache.mid_list[vid].splice(cindex, 1);
    }
  }
}

_via_data.prototype._cache_update_mid_list = function() {
  var vid;
  this.cache.mid_list = {};
  for ( var mid in this.store.metadata ) {
    vid = this.store.metadata[mid].vid;
    if ( ! this.cache.mid_list.hasOwnProperty(vid) ) {
      this.cache.mid_list[vid] = [];
    }
    this.cache.mid_list[vid].push(mid);
  }
}

_via_data.prototype._cache_update_attribute_group = function() {
  this.cache.attribute_group = {};
  var anchor_id;
  for ( var aid in this.store.attribute ) {
    anchor_id = this.store.attribute[aid].anchor_id;
    if ( ! this.cache.attribute_group.hasOwnProperty(anchor_id) ) {
      this.cache.attribute_group[anchor_id] = [];
    }
    this.cache.attribute_group[anchor_id].push(aid);
  }
}

//
// project
//
_via_data.prototype.project_save = function() {
  return new Promise( function(ok_callback, err_callback) {
    try {
      // @todo: decide on whether we want to include the base64 data
      // of inline files (i.e. this.store.file[fid].loc === _VIA_FILE_LOC.INLINE)
      var data_blob = new Blob( [JSON.stringify(this.store)],
                                {type: 'text/json;charset=utf-8'});
      var filename = [];
      if ( this.store.project.pid === _VIA_PROJECT_ID_MARKER ) {
        filename.push('via_project_');
      } else {
        filename.push(this.store.project.pid.substr(0,8) + '_');
      }
      filename.push(_via_util_date_to_filename_str(Date.now()));
      filename.push('.json');
      _via_util_download_as_file(data_blob, filename.join(''));
      ok_callback();
    }
    catch(err) {
      _via_util_msg_show('Failed to save project! [' + err + ']');
      err_callback();
    }
  }.bind(this));
}

_via_data.prototype.project_load = function(project_data_str) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      var project_data = JSON.parse(project_data_str);
      this.store = this.project_store_apply_version_fix(project_data);
      this._cache_update();
      this.emit_event( 'project_loaded', { 'pid':this.store.project.pid } );
      ok_callback();
    }
    catch(err) {
      _via_util_msg_show('Failed to load project! [' + err + ']');
      this._init_default_project();
      console.log(err)
      this.emit_event( 'project_load', { 'pid':this.store.project.pid } );
      err_callback();
    }
  }.bind(this));
}

_via_data.prototype.project_load_json = function(project_json_data) {
  return new Promise( function(ok_callback, err_callback) {
    try {
      var project_data = Object.assign({}, project_json_data);
      this.store = this.project_store_apply_version_fix(project_data);
      this._cache_update();
      this.emit_event( 'project_loaded', { 'pid':this.store.project.pid } );
      ok_callback();
    }
    catch(err) {
      _via_util_msg_show('Failed to load project! [' + err + ']');
      this._init_default_project();
      console.warn('failed to load project')
      console.log(err)
      this.emit_event( 'project_load', { 'pid':this.store.project.pid } );
      err_callback();
    }
  }.bind(this));
}

_via_data.prototype.project_store_apply_version_fix = function(d) {
  switch(d['project']['data_format_version']) {
  case '3.1.0':
    var local_prefix = d['config']['file']['path'];
    delete d['config']['file']['path'];
    d['config']['file']['loc_prefix'] = { '1':'', '2':'', '3':'', '4':'' };
    d['config']['file']['loc_prefix'][_VIA_FILE_LOC.LOCAL] = local_prefix;
    d['project']['data_format_version'] = this.DATA_FORMAT_VERSION;
    d['project']['vid_list'] = d['vid_list'];
    delete d['vid_list'];
    return d;
    break;
  default:
    return d;
    break;
  }
}

_via_data.prototype.project_is_remote = function() {
  if ( this.store.project.pid === _VIA_PROJECT_ID_MARKER &&
       this.store.project.rev === _VIA_PROJECT_REV_ID_MARKER &&
       this.store.project.rev_timestamp === _VIA_PROJECT_REV_TIMESTAMP_MARKER
     ) {
    return false;
  } else {
    return true;
  }
}

//
// merge
//
_via_data.prototype.project_merge_rev = function(d) {
  return new Promise( function(ok_callback, err_callback) {
    if ( this.store.project.pid !== d.project.pid ) {
      err_callback('pid mismatch');
      return;
    }

    var rev0 = this.store.project.rev;
    var rev1 = d.project.rev;
    var merge_stat = { 'rev':d.project.rev, 'rev_timestamp':d.project.rev_timestamp };

    try {
      // merge project
      if ( this.store.project['pname'] !== d.project['pname'] ) {
        this.store.project['pname'] = this.conflict_merge_str(rev0, this.store.project['pname'],
                                                              rev1, d.project['pname']);
      }
      var added_vid_list = [];
      if ( ! _via_util_array_eq(this.store.project['vid_list'], d.project['vid_list']) ) {
        for ( var vindex in d.project['vid_list'] ) {
          if ( ! d.project['vid_list'][vindex] in this.store.project['vid_list'] ) {
            this.store.project['vid_list'].push( d.project['vid_list'][vindex] );
            added_vid_list.push( d.project['vid_list'][vindex] );
          }
        }
      }
      merge_stat['vid_list'] = added_vid_list.length;

      // merge config
      for ( var lid in d.config.file.loc_prefix ) {
        if ( this.store.config.file.loc_prefix[lid] !== d.config.file.loc_prefix[lid] ) {
          this.store.config.file.loc_prefix[lid] = this.conflict_merge_str(rev0, this.store.config.file.loc_prefix[lid],
                                                                           rev1, d.config.file.loc_prefix[lid]);
        }
      }

      // merge attribute
      var new_aid_list = [];
      for ( var aid in d.attribute ) {
        if ( this.store.attribute.hasOwnProperty(aid) ) {
          // update existing attribute (if needed)
          if ( this.store.attribute[aid]['aname'] !== d.attribute[aid]['aname'] ) {
            this.store.attribute[aid]['aname'] = this.conflict_merge_str(rev0, this.store.attribute[aid]['aname'],
                                                                         rev1, d.attribute[aid]['aname']);
          }
          if ( this.store.attribute[aid]['desc'] !== d.attribute[aid]['desc'] ) {
            this.store.attribute[aid]['desc'] = this.conflict_merge_str(rev0, this.store.attribute[aid]['desc'],
                                                                        rev1, d.attribute[aid]['desc']);
          }
          for ( var oid in d.attribute[aid]['options'] ) {
            if ( this.store.attribute[aid]['options'].hasOwnProperty(oid) ) {
              if ( this.store.attribute[aid]['options'][oid] !== d.attribute[aid]['options'][oid] ) {
                // update existing option
                this.store.attribute[aid]['options'][oid] = this.conflict_merge_str(rev0, this.store.attribute[aid]['options'][oid],
                                                                                    rev1, d.attribute[aid]['options'][oid]);
              }
            } else {
              // add new options
              this.store.attribute[aid]['options'][oid] = d.attribute[aid]['options'][oid];
            }
          }
        } else {
          // add new attribute
          this.store.attribute[aid] = d.attribute[aid];
          new_aid_list.push(aid);
        }
      }
      merge_stat['aid_list'] = new_aid_list.length;

      // merge file
      var new_fid_list = [];
      for ( var fid in d.file ) {
        if ( this.store.file.hasOwnProperty(fid) ) {
          // update existing file (if needed)
          if ( this.store.file[fid]['fname'] !== d.file[fid]['fname'] ) {
            this.store.file[fid]['fname'] = this.conflict_merge_str(rev0, this.store.file[fid]['fname'],
                                                                    rev1, d.file[fid]['fname']);
          }
          if ( this.store.file[fid]['src'] !== d.file[fid]['src'] ) {
            this.store.file[fid]['src'] = this.conflict_merge_str(rev0, this.store.file[fid]['src'],
                                                                  rev1, d.file[fid]['src']);
          }
        } else {
          // add new file
          this.store.file[fid] = d.file[fid];
          new_fid_list.push(fid);
        }
      }
      merge_stat['fid_list'] = new_fid_list.length;

      // merge view
      for ( var vid in d.view ) {
        if ( this.store.view.hasOwnProperty(vid) ) {
          for ( var findex in d.view[vid]['fid_list'] ) {
            var fid = d.view[vid]['fid_list'][findex];
            if ( ! fid in this.store.view[vid]['fid_list'] ) {
              this.store.view[vid]['fid_list'].push(fid);
            }
          }
        } else {
          this.store.view[vid] = d.view[vid];
        }
      }

      // merge metadata
      var conflict_metadata_list = [];
      var new_mid_list = [];
      for ( var mid in d.metadata ) {
        if ( this.store.metadata.hasOwnProperty(mid) ) {
          // has something changed?
          var mine  = JSON.stringify(this.store.metadata[mid]);
          var their = JSON.stringify(d.metadata[mid]);
          if ( mine !== their ) {
            // add remote metadata as a new metadata
            conflict_metadata_list.push( d.metadata[mid] );
          }
        } else {
          // add new metadata
          this.store.metadata[mid] = d.metadata[mid];
          new_mid_list.push(mid);
        }
      }
      merge_stat['mid_list'] = new_mid_list.length;
      if ( conflict_metadata_list.length ) {
        this.metadata_add_bulk(conflict_metadata_list, false).then( function(ok) {
          merge_stat['conflict_mid_list'] = ok.length;
          this.project_merge_on_success(merge_stat);
        }.bind(this), function(err) {
          err_callback();
        }.bind(this));
      } else {
        this.project_merge_on_success(merge_stat);
      }
    }
    catch (e) {
      _via_util_msg_show('Merge failed: ' + e, true);
      console.warn(e);
      err_callback(e);
    }
  }.bind(this));
}

_via_data.prototype.project_merge_on_success = function(merge_stat) {
  this.store.project.rev = merge_stat.rev;
  this.store.project.rev_timestamp = merge_stat.rev_timestamp;
  this._cache_update();
  delete merge_stat['rev_timestamp'];
  this.emit_event( 'project_updated', { 'pid':this.store.project.pid } );

  var summary = [];
  if ( merge_stat['vid_list'] !== 0 ) {
    summary.push(merge_stat['vid_list'] + ' new views');
  }
  if ( merge_stat['aid_list'] !== 0 ) {
    summary.push(merge_stat['aid_list'] + ' new attributes');
  }
  if ( merge_stat['fid_list'] !== 0 ) {
    summary.push(merge_stat['fid_list'] + ' new files');
  }
  if ( merge_stat['mid_list'] !== 0 ) {
    summary.push(merge_stat['mid_list'] + ' new metadata');
  }
  if ( merge_stat.hasOwnProperty('conflict_mid_list') ) {
    summary.push(merge_stat['conflict_mid_list'] + ' metadata with conflicts');
  }
  _via_util_msg_show('Successfully merged to revision ' + merge_stat['rev'] + ' (with ' + summary.join(', ') + ')', true);
}

_via_data.prototype.conflict_merge_str = function(rev0, s0, rev1, s1) {
  return 'CONFLICT{rev' + rev0 + '=' + s0 + '|rev' + rev1 + '=' + s1 + '}';
}

// is there any difference between local project and remote project?
_via_data.prototype.project_is_different = function(others_str) {
  return new Promise( function(ok_callback, err_callback) {
    var ours_str = JSON.stringify(this.store);
    if ( ours_str === others_str ) {
      err_callback();
    } else {
      ok_callback(others_str);
    }
  }.bind(this));
}
