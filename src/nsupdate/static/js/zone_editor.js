function zone_editor(grid_id, error_id, controls_id) {
  this_ = this;

  var rndsep = Math.floor(Math.random() * 9e6).toString(36);

  function is_nonemptystring(str) {
    return typeof str === 'string' && str.length > 0;
  }

  function uint32_to_base64(n) {
    n = n >>> 0; // ensure unsigned 32-bit
    const bytes = new Uint8Array([
      (n >>> 24) & 0xFF,
      (n >>> 16) & 0xFF,
      (n >>>  8) & 0xFF,
      (n       ) & 0xFF
    ]);
    // convert bytes to binary string for btoa
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    // convert string to base, replace ugly characters and padding
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function hash32(str) {
    let h = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      // multiply by FNV prime (0x01000193) using shifts to stay in 32-bit range
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h >>> 0; // 0 .. 2^32-1
  }

  function row_hash(row_data) {
    ["name", "class", "type", "ttl", "data"].forEach(function(f) {
      if (!(f in row_data)) {
        this_.serious_error();
      }
    });
    // data_str = [row_data["name"], row_data["class"], row_data["type"], row_data["ttl"], row_data["data"]].join(rndsep);
    data_str = [row_data["name"], row_data["class"], row_data["type"], row_data["data"]].join(rndsep);
    uint32_hash = hash32(data_str);
    str_hash = uint32_to_base64(uint32_hash);
    // console.error("row_hash", row_data, str_hash);
    return str_hash;
  }

  function naturalCompare(str1, str2) {
    return str1.localeCompare(str2, undefined, {numeric: true});
  }

  function arrayNaturalCompare(ar1, ar2) {
    var i=0;
    for (var i=0; i<ar1.length && i<ar2.length; i++) {
      if (ar1[i] !== ar2[i]) {
        return naturalCompare(ar1[i], ar2[i]);
      }
    }
    return ar1.length - ar2.length;
  }

  function dottedCompare(str1, str2) {
    var ar1 = str1.split(".");
    var ar2 = str2.split(".");
    return arrayNaturalCompare(ar1, ar2);
  }

  function reverseDottedCompare(str1, str2) {
    var ar1 = str1.split(".").reverse();
    var ar2 = str2.split(".").reverse();
    return arrayNaturalCompare(ar1, ar2);
  }

  // var sti=0;
  function zone_record_compare(rowA, rowB) {
    // console.log(sti++, rowA, rowB);
    if (rowA.type === "SOA" && rowB.type !== "SOA")
      return -1;
    if (rowA.type !== "SOA" && rowB.type === "SOA")
      return 1;
    if (rowA.name.startsWith("@") && !rowB.name.startsWith("@"))
      return -1;
    if (!rowA.name.startsWith("@") && rowB.name.startsWith("@"))
      return 1;
    if (rowA.name !== rowB.name)
      return reverseDottedCompare(rowA.name, rowB.name);
    if (rowA.type !== rowB.type)
      return naturalCompare(rowA.type, rowB.type);
    if (rowA.class !== rowB.class)
      return naturalCompare(rowA.class, rowB.class);
    if (rowA.data === rowB.data)
      return rowA.ttl - rowB.ttl;
    if (rowA.type === "A")
      return dottedCompare(rowA.data, rowB.data);
    if (rawA.type === "PTR")
      return reverseDottedCompare(rowA.data, rowB.data);
    return naturalCompare(rowA.data, rowB.data);
  }

  function autostep_string(str) {
    if (str === "") {
      return "0";
    }
    var m = str.match(/^(.*?)(\d*)$/);
    var prefix = m[1];
    var digits = m[2];
    if (digits === "") {
      digits = 2;
    } else {
      digits = parseInt(digits, 10) + 1;
    }
    return prefix + digits;
  }

  function autostep_stringlist(lst) {
    if (lst.length === 0) {
      return ["1"];
    }
    var result = [...lst];
    result[0] = autostep_string(result[0]);
    return result;
  }

  function autostep_ip(ip) {
    var ip=ip.split(".");
    ip.reverse();
    ip = autostep_stringlist(ip);
    ip.reverse();
    return ip.join(".");
  }

  function autostep_hostname(hostname) {
    var hostname = hostname.split(".");
    hostname = autostep_stringlist(hostname);
    return hostname.join(".");
  }

  function editable(params) {
    console.log("editable", params);
    return params.data.state === "to-add";
  }

  this.grid_node = document.getElementById(grid_id);
  this.error_node = document.getElementById(error_id);
  this.controls_node = document.getElementById(controls_id);
  this.error = "";
  this.api = false;
  this.inited = false;

  this.control_buttons = {};

  this.init_main_controls = function() {
    Object.keys(this.main_controls).forEach(function(name) {
      var b = this_.controls_node.querySelector('.zone_editor_' + name);
      this_.control_buttons[name] = b;
      var handler = this_.main_controls[name];
      b.addEventListener('click', function() { this_.main_controls[name].bind(this_)(); });
    });
  }

  this.control_reload_click = function() {
    console.log('reload');
    this.start_dl_animation();
    rest_url = new URL('../zone_json/', window.location.href).href;
    fetch(rest_url)
      .then(function(response) {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        } else {
          return response.json();
        }
      })
      .then(function(json_data) {
        this_.new_data_cb(json_data);
      })
      .catch(function(err) {
        this_.stop_dl_animation();
        this_.set_error(err);
      });
  }

  this.control_discard_click = function() {
    console.log('discard');
  }

  this.control_apply_click = function() {
    console.log('apply');
  }

  this.control_changes_only_click = function() {
    console.log('changes_only');
  }

  this.control_new_record_click = function() {
    console.log('new record');
  }

  this.control_script_click = function() {
    console.log('script');
  }

  this.main_controls = {
    "reload": this.control_reload_click,
    "discard": this.control_discard_click,
    "apply": this.control_apply_click,
    "changes_only": this.control_changes_only_click,
    "new_record": this.control_new_record_click,
    "script": this.control_script_click
  }

  this.grid_options = {
    columnDefs: [
      { headerName: "name",
        field: "name",
        cellClass: "zone-editor-name",
        sortable: true,
        editable: editable,
        valueSetter: function(params) { return this_.value_setter(params); } 
      },
      { headerName: "class",
        field: "class",
        cellClass: "zone-editor-class",
        sortable: true,
        editable: editable,
        valueSetter: function(params) { return this_.value_setter(params); } 
      },
      { headerName: "type",
        field: "type",
        cellClass: "zone-editor-type",
        sortable: true,
        editable: editable,
        valueSetter: function(params) { return this_.value_setter(params); } 
      },
      { headerName: "ttl",
        field: "ttl",
        cellClass: "zone-editor-ttl",
        sortable: true,
        editable: editable,
        valueSetter: function(params) { return this_.value_setter(params); } 
      },
      { headerName: "data",
        field: "data",
        cellClass: "zone-editor-data",
        sortable: true,
        editable: editable,
        valueSetter: function(params) { return this_.value_setter(params); } 
      },
      { headerName: "state",
        field: "state",
        cellClass: "zone-editor-state",
        editable: false
      },
      { headerName: "controls",
        field: "controls",
        cellClass: "zone-editor-controls",
        editable: false,
        cellRenderer: function(params) { return this_.control_cell_html(params); }
      },
      { headerName: "sort",
        field: "natural_sort",
        sortable: true,
        resizable: false,
        minWidth: 48,
        //hide: true,
        editable: false,
        comparator: function(valueA, valueB, nodeA, nodeB) { return zone_record_compare(nodeA.data, nodeB.data); }
      }
    ],
    rowData: [],
    defaultColDef: {
      resizable: true,
      flex: 1,
      minWidth: 96,
      sortable: false
    },
    // KEY: let the grid size itself to its content
    domLayout: 'autoHeight',
    animateRows: true,
    theme: 'legacy',
    onFirstDataRendered: function(param) {
      this_.on_first_data_rendered(param);
    },
    onColumnResized: function(param) {
      this_.recalc_width(param);
    },
    onGridReady: function(params) {
      this_.api = params.api;
      this_.inited = true;
      params.api.applyColumnState({
        state: [{colId: 'natural_sort', sort: 'asc', sortIndex: 0}],
        defaultState: { sort: null }
      });
      params.api.refreshClientSideRowModel('sort');
      params.api.onSortChanged();
    },
    onCellValueChanged: function(params) {
      this_.on_cell_value_changed(params);
    },
    getRowId: function(row) {
      return this_.get_row_id(row.data);
    },
    getRowClass: function(params) {
      row_class = "zone-editor-row-" + params.data.state;
      /*
      if (is_nonemptystring(params.data.error)) {
        row_class = [row_class, "row-error"];
      }
      */
      return row_class;
    }
  };

  this.get_row_id = function(row_data) {
    var id;
    if ("id" in row_data) {
      id = row_data["id"];
    } else {
      id = row_hash(row_data);
    }
    // console.error("get_row_id", id, row_data);
    return id;
  }

  this.set_error = function(error) {
    this.error = error;
    if (is_nonemptystring(this.error)) {
      zone_editor_error.style.display = "block";
      zone_editor_error.innerHTML = this.error;
    } else {
      zone_editor_error.style.display = "none";
      zone_editor_error.innerHTML = "";
    }
  }

  this.serious_error = function() {
    this.set_error("Serious error - save your not applied changes");
  }

  this.recalc_width = function(params) {
    this.params = params;
    if (this.grid_options.rowData.length === 0)
      return;

    const cols = params.api.getColumns();
    let total = 0;
    cols.forEach(function(c) {
      if (typeof c.colDef.hide === 'undefined' || c.colDef.hide !== true)
        total += c.getActualWidth();
    });
    // const padding = 16; // scrollbar / safety
    const padding = 0;
    new_width = (total + padding) + 'px';
    this.grid_node.style.width = new_width;
  }

  this.on_first_data_rendered = function(params) {
    this.params = params;
    if (this.grid_options.rowData.length === 0)
      return;

    // autosize every column based on cell contents (skipHeader = true reduces header influence)
    const cols = params.api.getColumns();
    const colIds = cols.map(c => c.getId());
    params.api.autoSizeColumns(colIds, /*skipHeader=*/ true);
    this.recalc_width(params);
  }

  this.start_dl_animation = function() {
    this.controls_node.querySelector(".reload-icon").classList.add("pulse");
  }

  this.stop_dl_animation = function() {
    this.controls_node.querySelector(".reload-icon").classList.remove("pulse");
  }

  this.new_data_cb = function(data) {
    data.records.forEach(row => {
      row["state"] = "vanilla";
      row["controls"] = "";
      // row["error"] = "";
      row["natural_sort"] = "";
    });
    this.grid_options.rowData = data["records"];
    this.set_error(data["error"]);
    this.stop_dl_animation();
    if (this.inited) {
      this.api.refreshCells();
    } else {
      agGrid.createGrid(this.grid_node, this.grid_options);
    }
  }

  this.control_cell_html = function(gridparams) {
    // console.error('control_cell_html', gridparams);
    var buttons=[
      ['clone', this_.on_control_click_clone, ['fa-solid', 'fa-clone']],
      ['edit', this_.on_control_click_edit, ['fa-solid', 'fa-pen-to-square']],
      ['cancel', this_.on_control_click_cancel, ['fa-solid', 'fa-xmark']],
      ['delete', this_.on_control_click_delete, ['fa-regular', 'fa-trash-can']]
    ];
    var controls_node = document.createElement('span');
    for (button of buttons) {
      var button_node = document.createElement('button');
      var button_name = button[0];
      var button_onclick = button[1];
      var icon_node = document.createElement('i');
      var icon_classlist = button[2];
      icon_node.classList.add.apply(icon_node.classList, icon_classlist);
      button_node.type = 'button';
      button_node.classList.add('btn', 'btn-xs', 'btn-primary', 'zone-editor-btn-' + button_name);
      button_node.append(icon_node);
      button_label = document.createTextNode(' ' + button_name);
      button_node.appendChild(button_label);
      controls_node.append(button_node, ' ');
      this_.add_click_listener(button_node, button_onclick, gridparams);
    }
    return controls_node;
  }

  this.add_click_listener = function(button_node, button_onclick, gridparams) {
    button_node.addEventListener('click', function(params) { button_onclick.bind(this_)(gridparams); });
  }

  // vanilla: new copy with the "to-add" state.
  // to-delete: new copy with "to-add" state.
  // to-add: new copy with "to-add" state.
  this.on_control_click_clone = function(params) {
    // console.log("clone");
    // console.log(params);
    switch (params.data["state"]) {
      case "vanilla":
      case "to-add":
      case "to-delete":
        this.add_row({...params.data, "state": "to-add"});
        break;
      default:
        this.serious_error();
    }
  }

  // vanilla: changes row to "to-delete" state, creates a clone as "to-add" state.
  // to-delete: should not be visible
  // to-add: should not be visible, but the fields should be visually editable (like an iron icon in all columns)
  this.on_control_click_edit = function(params) {
    // console.log("edit");
    // console.log(params);
    switch (params.data["state"]) {
      case "vanilla":
        this.update_row(params.node.id, {"state": "to-delete"});
        this.add_row({...params.data, "state": "to-add"});
        break;
      default:
        this.serious_error();
    }
  }

  // vanilla: does not show
  // to-delete: changes back to "vanilla"
  // to-add: deletes row
  this.on_control_click_cancel  = function(params) {
    // console.log("cancel");
    // console.log(params);
    switch (params.data["state"]) {
      case "to-delete":
        this.update_row(params.node.id, {"state": "vanilla"});
        break;
      case "to-add":
        this.delete_row(params.node.id);
        break;
      default:
        this.serious_error();
    }
  }

  // vanilla: changes to "to-delete"
  // to-delete: does not show
  // to-add: does not show
  this.on_control_click_delete = function(params) {
    // console.log("delete");
    // console.log(params);
    switch (params.data["state"]) {
      case "vanilla":
        this.update_row(params.node.id, {"state": "to-delete"});
        break;
      default:
        this.serious_error();
    }
  }

  this.add_row = function(data) {
    // console.log("add_row");
    // console.log(data);
    var default_data = {
      "name": "",
      "class": "IN",
      "type": "A",
      "ttl": "3600",
      "data": "",
      "state": "to-add",
      "controls": "",
      // "error": "",
      "natural_sort": ""
    }
    var new_data = { ...default_data, ...data };
    new_data = this.autostep_row(new_data);
    this.grid_options.rowData.push(new_data);
    this.api.applyTransaction({add: [new_data]});
    this.api.redrawRows({rowNodes: [new_data]});
    this.api.refreshCells({force: true});
  }

  this.update_row = function(row_id, data) {
    var row_node = this.api.getRowNode(row_id);
    var updated = { ...row_node.data, ...data};
    this.api.applyTransaction({update: [updated]});
    this.api.redrawRows({rowNodes: [row_node]});
  }

  this.clone_row = function(row_id) {
    this.update_row(row_id, {"state": "to-delete"});
    this.add_row({...params.data, "state": "to-add"});
  }

  this.delete_row = function(row_id) {
    var row_node = this.api.getRowNode(row_id);
    var to_delete = row_node.data;
    // this.api.applyTransaction({remove: [to_delete]});
    this.api.applyTransaction({remove: [{id: row_id}]});
  }

  this.autostep_row = function(row_data) {
    console.log("autostep_row", row_data);
    var new_data = { ...row_data };
    while (true) {
      new_id = this.get_row_id(new_data);
      // console.error("new_id: " + new_id);
      if (this.api.getRowNode(new_id)) {
        if (new_data["type"] === "A") {
          new_data["data"] = autostep_ip(new_data["data"]);
        } else {
          new_data["name"] = autostep_hostname(new_data["name"]);
        }
      } else {
        console.log(new_data);
        return new_data;
      }
    }
  }

  this.do_dump = function() {
    var td=[]
    // console.log("test1", this.grid_options.rowData);
    this.grid_options.rowData.forEach(function(p) {
      // console.log(p)
      var q = {...p};
      q["id"] = row_hash(q);
      td.push(q);
    });
    console.log(td);
  }

  this.value_setter = function(params) {
    console.log('value_setter', params);
    return true;
  }

  this.on_cell_value_changed = function(params) {
    // changed field name: params.column.colId
    // changed row data (new data): params.data
    // changed row, old id: params.node.id
    // changed row, new id: must be calculated
    // old value: params.oldValue
    // new value: params.newValue
    var old_id = params.node.id;
    var new_data = params.data;
    var new_id = this.get_row_id(params.data);
    var row_index = params.rowIndex;
    console.log('on_cell_value_changed', 'params', params, 'row_index: ', row_index, 'old id: ', old_id, 'new id: ', new_id, 'new data: ', new_data);

    // this.delete_row(old_id);
    // this.add_row(new_data);
    // this.update_row(new_id, new_data);
    this.api.refreshCells({force: true});
  }

  this.init_main_controls();
}

var zone_editor_obj = new zone_editor('zone_editor_grid', 'zone_editor_error', 'zone_editor_controls');
