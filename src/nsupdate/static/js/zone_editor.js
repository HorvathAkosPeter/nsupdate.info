function zone_editor(grid_id, error_id, controls_id, help_id) {
  this_ = this;

  // internal state

  this.grid_node = document.getElementById(grid_id);
  this.error_node = document.getElementById(error_id);
  this.controls_node = document.getElementById(controls_id);
  this.help_node = document.getElementById(help_id);
  this.api = false;
  this.inited = false;
  this.zone_name = "";
  this.ddns_param = {
    "key_type": "",
    "key_name": "",
    "key_value": "",
    "ddns_protocol": "",
    "ddns_host": "",
    "ddns_port": ""
  };
  this.rndsep = Math.floor(Math.random() * 9e6).toString(36);

  // utility library functions

  function is_nonemptystring(str) {
    return typeof str === "string" && str.length > 0;
  }

  function get_cookie(name) {
    let cookie_value = null;
    console.log("get_cookie", document.cookie);
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        // Does this cookie string begin with the name we want?
        if (cookie.substring(0, name.length + 1) === name + "=") {
          cookie_value = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookie_value;
  }

  function uint32_to_base64(n) {
    n = n >>> 0; // ensure unsigned 32-bit
    const bytes = new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
    // convert bytes to binary string for btoa
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    // convert string to base, replace ugly characters and padding
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    ["name", "class", "type", "ttl", "data"].forEach(function (f) {
      if (!(f in row_data)) {
        this_.serious_error();
      }
    });
    // data_str = [row_data["name"], row_data["class"], row_data["type"], row_data["ttl"], row_data["data"]].join(this.rndsep);
    data_str = [row_data["name"], row_data["class"], row_data["type"], row_data["data"]].join(this.rndsep);
    uint32_hash = hash32(data_str);
    str_hash = uint32_to_base64(uint32_hash);
    // console.error("row_hash", row_data, str_hash);

    // str_hash = [row_data["name"], row_data["class"], row_data["type"], row_data["ttl"], row_data["data"]].join("|");
    return str_hash;
  }

  function naturalCompare(str1, str2) {
    return str1.localeCompare(str2, undefined, { numeric: true });
  }

  function arrayNaturalCompare(ar1, ar2) {
    var i = 0;
    for (var i = 0; i < ar1.length && i < ar2.length; i++) {
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
    if (rowA.type === "SOA" && rowB.type !== "SOA") return -1;
    if (rowA.type !== "SOA" && rowB.type === "SOA") return 1;
    if (rowA.name.startsWith("@") && !rowB.name.startsWith("@")) return -1;
    if (!rowA.name.startsWith("@") && rowB.name.startsWith("@")) return 1;
    if (rowA.name !== rowB.name) return reverseDottedCompare(rowA.name, rowB.name);
    if (rowA.type !== rowB.type) return naturalCompare(rowA.type, rowB.type);
    if (rowA.class !== rowB.class) return naturalCompare(rowA.class, rowB.class);
    if (rowA.data === rowB.data) return rowA.ttl - rowB.ttl;
    if (rowA.type === "A") return dottedCompare(rowA.data, rowB.data);
    if (rawA.type === "PTR") return reverseDottedCompare(rowA.data, rowB.data);
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
    var ip = ip.split(".");
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

  function is_editable(params) {
    // console.log("editable", params);
    return params.data.state === "to-add";
  }

  // utility methods

  this.set_zone_name = function(new_name) {
    this.zone_name = new_name;
    var node = this.controls_node.querySelector(".zone_editor_zone_name");
    if (node)
      node.innerText = new_name;
  }

  this.get_row_id = function (row_data) {
    var id;
    if ("id" in row_data) {
      id = row_data["id"];
    } else {
      id = row_hash(row_data);
    }
    // console.error("get_row_id", id, row_data);
    return id;
  };

  this.hide_messagebox = function () {
    this.error_node.style.display = "none";
  };

  this.set_messagebox = function (style, msg) {
    var styles = ["success", "warning", "danger"];
    styles.forEach(function (name) {
      var css_class_name = "alert-" + name;
      console.log(name, style);
      if (name === style) {
        this_.error_node.classList.add(css_class_name);
      } else {
        this_.error_node.classList.remove(css_class_name);
      }
    });
    while (this.error_node.firstChild) {
      this.error_node.removeChild(this.error_node.lastChild);
    }
    if (is_nonemptystring(msg)) {
      this.error_node.style.display = "block";
      var btn_node = document.createElement("button");
      btn_node.classList.add("btn-close");
      btn_node.style.display = "block";
      btn_node.style.float = "right";
      var msg_node = document.createTextNode(msg);
      this.error_node.appendChild(btn_node);
      this.error_node.appendChild(msg_node);
      btn_node.addEventListener("click", function () {
        this_.hide_messagebox();
      });
    } else {
      this.hide_messagebox();
    }
  };

  this.set_notice = function (notice) {
    this.set_messagebox("success", notice);
  };

  this.set_warning = function (warning) {
    this.set_messagebox("warning", warning);
  };

  this.set_error = function (error) {
    this.set_messagebox("danger", error);
  };

  this.serious_error = function (error) {
    this.set_error("Serious error - save your not applied changes");
    throw new Error(error);
  };

  this.start_reload_animation = function () {
    this.controls_node.querySelector(".zone_editor_reload_icon").classList.add("zone_editor_reload_anim");
  };

  this.stop_reload_animation = function () {
    this.controls_node.querySelector(".zone_editor_reload_icon").classList.remove("zone_editor_reload_anim");
  };

  this.start_apply_animation = function () {
    this.controls_node.querySelector(".zone_editor_apply_icon").classList.add("zone_editor_apply_anim");
  };

  this.stop_apply_animation = function () {
    this.controls_node.querySelector(".zone_editor_apply_icon").classList.remove("zone_editor_apply_anim");
  };

  this.add_click_listener = function (button_node, button_onclick, gridparams) {
    button_node.addEventListener("click", function (params) {
      button_onclick.bind(this_)(gridparams);
    });
  };

  this.add_row = function (data) {
    // console.log("add_row");
    // console.log(data);
    var default_data = {
      name: "",
      class: "IN",
      type: "A",
      ttl: "3600",
      data: "",
      state: "to-add",
      controls: "",
      // "error": "",
      natural_sort: "",
    };
    var new_data = { ...default_data, ...data };
    new_data = this.autostep_row(new_data);
    this.grid_options.rowData.push(new_data);
    this.api.applyTransaction({ add: [new_data] });
    this.api.redrawRows({ rowNodes: [new_data] });
    this.api.refreshCells({ force: true });
  };

  this.update_row = function (row_id, data) {
    var row_node = this.api.getRowNode(row_id);
    var updated = { ...row_node.data, ...data };
    this.api.applyTransaction({ update: [updated] });
    this.api.redrawRows({ rowNodes: [row_node] });
  };

  this.clone_row = function (row_id) {
    this.update_row(row_id, { state: "to-delete" });
    this.add_row({ ...params.data, state: "to-add" });
  };

  this.delete_row = function (row_id) {
    var row_node = this.api.getRowNode(row_id);
    var to_delete = row_node.data;
    this.api.applyTransaction({ remove: [{ id: row_id }] });
  };

  this.autostep_row = function (row_data) {
    // console.log("autostep_row", row_data);
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
        // console.log(new_data);
        return new_data;
      }
    }
  };

  this.recalc_width = function (params) {
    this.params = params;
    if (this.grid_options.rowData.length === 0) return;

    const cols = params.api.getColumns();
    let total = 0;
    cols.forEach(function (c) {
      if (typeof c.colDef.hide === "undefined" || c.colDef.hide !== true) total += c.getActualWidth();
    });
    // const padding = 16; // scrollbar / safety
    const padding = 0;
    new_width = total + padding + "px";
    this.grid_node.style.width = new_width;
  }

  this.do_dump = function () {
    var td = [];
    // console.log("test1", this.grid_options.rowData);
    this.grid_options.rowData.forEach(function (p) {
      // console.log(p)
      var q = { ...p };
      q["id"] = row_hash(q);
      td.push(q);
    });
    console.log(td);
  };

  // main control block

  this.main_controls_buttons = {};

  this.main_controls_init = function () {
    Object.keys(this.main_controls_methods).forEach(function (name) {
      var b = this_.controls_node.querySelector(".zone_editor_" + name);
      this_.main_controls_buttons[name] = b;
      b.addEventListener("click", function () {
        this_.main_controls_methods[name].bind(this_)();
      });
    });
    if (window.localStorage.getItem("zone_editor_show_help") === "false") {
      this.main_controls_help(false);
    }
  };

  this.main_controls_reload = function () {
    console.log("reload");
    this.start_reload_animation();
    var rest_url = new URL("../zone_json/", window.location.href).href;
    fetch(rest_url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        } else {
          return response.json();
        }
      })
      .then(function (json_data) {
        this_.new_data_cb(json_data);
      })
      .catch(function (err) {
        this_.stop_reload_animation();
        this_.set_error(err);
      });
  };

  this.main_controls_discard = function () {
    console.log("discard");
    // this.do_dump();

    var to_remove = [];
    var to_update = [];
    this.api.forEachNode(function (node) {
      switch (node.data.state) {
        case "to-add":
          to_remove.push({ id: node.id });
          break;
        case "to-delete":
          to_update.push({ ...node.data, state: "vanilla" });
          break;
        case "vanilla":
          break;
        default:
          this.serious_error();
      }
    });
    this.api.applyTransaction({ remove: to_remove, update: to_update });
    this.api.redrawRows();
  };

  this.main_controls_apply = function () {
    console.log("apply");
    this.start_apply_animation();
    var changes = [];
    var rest_url = new URL("../zone_json/", window.location.href).href;
    this.api.forEachNode(function (node) {
      var data = node.data;
      // console.log(node);
      if (["to-delete", "to-add"].includes(data.state)) {
        var change = {
          name: data["name"],
          class: data["class"],
          type: data["type"],
          ttl: data["ttl"],
          data: data["data"],
          state: data["state"],
        };
        changes.push(change);
      }
    });
    console.log("csrf", this.csrftoken);
    fetch(rest_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": this.csrftoken,
      },
      body: JSON.stringify(changes),
    })
      .then(function (response) {
        this_.stop_apply_animation();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        this_.set_notice('Server reports success. Suggestion: click "reload".');
      })
      .catch(function (error) {
        this_.stop_apply_animation();
        this_.set_error("DNS update error: " + error.message);
      });
  };

  this.main_controls_changes_only = function () {
    console.log("changes_only");
    var node = this.main_controls_buttons["changes_only"];
    if (node.classList.contains("zone_editor_button_pressed")) {
      node.classList.remove("zone_editor_button_pressed");
    } else {
      node.classList.add("zone_editor_button_pressed");
    }
    this.api.onFilterChanged();
  };

  this.main_controls_new_record = function () {
    console.log("new record");
    this.add_row({
      name: "a",
      class: "IN",
      type: "A",
      ttl: 3600,
      data: "1.1.1.1",
      state: "to-add",
    });
  };

  this.main_controls_script = function () {
    console.log("script");
  };

  this.main_controls_help = function (is_shown) {
    console.log("help");
    var show;
    var localstore_show = window.localStorage.getItem("zone_editor_show_help");
    if (localstore_show === "true") {
      localstore_show = true;
    } else if (localstore_show === "false") {
      localstore_show = false;
    } else {
      localstore_show = undefined;
    }
    if (is_shown === true) {
      show = true;
    } else if (is_shown === false) {
      show = false;
    } else if (localstore_show === false) {
      show = true;
    } else {
      show = false;
    }
    var node = this.main_controls_buttons["help"];
    if (show) {
      node.classList.remove("zone_editor_button_pressed");
      this.help_node.classList.remove("zone_editor_hide_help");
    } else {
      node.classList.add("zone_editor_button_pressed");
      this.help_node.classList.add("zone_editor_hide_help");
    }
    window.localStorage.setItem("zone_editor_show_help", show);
  };

  this.main_controls_methods = {
    reload: this.main_controls_reload,
    discard: this.main_controls_discard,
    apply: this.main_controls_apply,
    changes_only: this.main_controls_changes_only,
    new_record: this.main_controls_new_record,
    script: this.main_controls_script,
    help: this.main_controls_help
  };

  // grid params

  this.grid_options = {
    columnDefs: [
      {
        headerName: "name",
        field: "name",
        cellClass: "zone_editor_name",
        sortable: true,
        editable: is_editable,
        valueSetter: function (params) {
          return this_.value_setter(params);
        },
      },
      {
        headerName: "class",
        field: "class",
        cellClass: "zone_editor_class",
        sortable: true,
        editable: is_editable,
        valueSetter: function (params) {
          return this_.value_setter(params);
        },
      },
      {
        headerName: "type",
        field: "type",
        cellClass: "zone_editor_type",
        sortable: true,
        editable: is_editable,
        valueSetter: function (params) {
          return this_.value_setter(params);
        },
      },
      {
        headerName: "ttl",
        field: "ttl",
        cellClass: "zone_editor_ttl",
        sortable: true,
        editable: is_editable,
        valueSetter: function (params) {
          return this_.value_setter(params);
        },
      },
      {
        headerName: "data",
        field: "data",
        cellClass: "zone_editor_data",
        sortable: true,
        editable: is_editable,
        valueSetter: function (params) {
          return this_.value_setter(params);
        },
      },
      {
        headerName: "state",
        field: "state",
        cellClass: "zone_editor_state",
        editable: false,
      },
      {
        headerName: "controls",
        field: "controls",
        cellClass: "zone_editor_controls",
        editable: false,
        cellRenderer: function (params) {
          return this_.rr_controls_cell_html(params);
        },
      },
      {
        headerName: "sort",
        field: "natural_sort",
        sortable: true,
        resizable: false,
        minWidth: 64,
        //hide: true,
        editable: false,
        comparator: function (valueA, valueB, nodeA, nodeB) {
          return zone_record_compare(nodeA.data, nodeB.data);
        },
      },
    ],
    rowData: [],
    defaultColDef: {
      resizable: true,
      flex: 1,
      minWidth: 96,
      sortable: false,
    },
    // KEY: let the grid size itself to its content
    domLayout: "autoHeight",
    animateRows: true,
    theme: "legacy",
    onFirstDataRendered: function (param) {
      this_.on_first_data_rendered(param);
    },
    onColumnResized: function (param) {
      this_.on_column_resized(param);
    },
    onGridReady: function (params) {
      this_.on_grid_ready(params);
    },
    onCellValueChanged: function (params) {
      this_.on_cell_value_changed(params);
    },
    getRowId: function (row) {
      return this_.get_row_id(row.data);
    },
    getRowClass: function (params) {
      // console.error(params.data);
      row_class = "zone_editor_row_" + params.data.state.replaceAll("-", "_");
      /*
                  if (is_nonemptystring(params.data.error)) {
                  row_class = [row_class, "row-error"];
                  }
                */
      return row_class;
    },
    isExternalFilterPresent: function () {
      return this_.main_controls_buttons["changes_only"].classList.contains("zone_editor_button_pressed");
    },
    doesExternalFilterPass: function (node) {
      return node.data["state"] !== "vanilla";
    },
  };

  // grid event handlers

  this.on_column_resized = function (params) {
    this.recalc_width(params);
  };

  this.on_grid_ready = function (params) {
    this.api = params.api;
    this.inited = true;
    params.api.applyColumnState({
      state: [{ colId: "natural_sort", sort: "asc", sortIndex: 0 }],
      defaultState: { sort: null },
    });
    params.api.refreshClientSideRowModel("sort");
    params.api.onSortChanged();
  }

  this.on_first_data_rendered = function (params) {
    this.params = params;
    if (this.grid_options.rowData.length === 0) return;

    // autosize every column based on cell contents (skipHeader = true reduces header influence)
    const cols = params.api.getColumns();
    const colIds = cols.map((c) => c.getId());
    params.api.autoSizeColumns(colIds, /*skipHeader=*/ true);
    this.recalc_width(params);
  };

  this.value_setter = function (params) {
    // console.log('value_setter', params);
    if (params.column.colId === "ttl") {
      params.newValue = parseInt(String(params.newValue), 10);
      if (!params.newValue || params.newValue < 1) {
        params.newValue = 1;
      }
    }
    var new_data = {};
    ["name", "class", "type", "ttl", "data"].forEach((p) => {
      new_data[p] = params.data[p];
    });
    new_data[params.column.colId] = params.newValue;
    new_data = this.autostep_row(new_data);
    ["name", "class", "type", "ttl", "data"].forEach((p) => {
      params.data[p] = new_data[p];
    });
    return true;
  };

  this.on_cell_value_changed = function (params) {
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
    console.log("on_cell_value_changed");
    console.log("params: ", params, "row_index: ", row_index, "old id: ", old_id, "new id: ", new_id, "new data: ", new_data);

    // this.delete_row(old_id);
    // this.add_row(new_data);
    // this.update_row(new_id, new_data);
    console.log(this.api);
    // this.api.setRowData(this.grid_options.rowData);
    this.api.setGridOption("rowData", this.grid_options.rowData);
    // this.api.refreshCells({force: true});
    this.api.redrawRows();
  };

  // resource record controls

  this.rr_controls_cell_html = function (gridparams) {
    var buttons = [
      ["clone", this_.rr_controls_clone, ["fa-solid", "fa-clone"]],
      ["edit", this_.rr_controls_edit, ["fa-solid", "fa-pen-to-square"]],
      ["cancel", this_.rr_controls_cancel, ["fa-solid", "fa-xmark"]],
      ["delete", this_.rr_controls_delete, ["fa-regular", "fa-trash-can"]],
    ];
    var controls_node = document.createElement("span");
    for (button of buttons) {
      var button_node = document.createElement("button");
      var button_name = button[0];
      var button_onclick = button[1];
      var icon_node = document.createElement("i");
      var icon_classlist = button[2];
      icon_node.classList.add.apply(icon_node.classList, icon_classlist);
      button_node.type = "button";
      button_node.classList.add("btn", "btn-xs", "btn-primary", "zone_editor_btn_" + button_name);
      button_node.append(icon_node);
      button_label = document.createTextNode(" " + button_name);
      button_node.appendChild(button_label);
      controls_node.append(button_node, " ");
      this_.add_click_listener(button_node, button_onclick, gridparams);
    }
    return controls_node;
  };

  // vanilla: new copy with the "to-add" state.
  // to-delete: new copy with "to-add" state.
  // to-add: new copy with "to-add" state.
  this.rr_controls_clone = function (params) {
    // console.log("clone");
    // console.log(params);
    switch (params.data["state"]) {
      case "vanilla":
      case "to-add":
      case "to-delete":
        this.add_row({ ...params.data, state: "to-add" });
        break;
      default:
        this.serious_error();
    }
  };

  // vanilla: changes row to "to-delete" state, creates a clone as "to-add" state.
  // to-delete: should not be visible
  // to-add: should not be visible, but the fields should be visually editable (like an iron icon in all columns)
  this.rr_controls_edit = function (params) {
    // console.log("edit");
    // console.log(params);
    switch (params.data["state"]) {
      case "vanilla":
        this.update_row(params.node.id, { state: "to-delete" });
        this.add_row({ ...params.data, state: "to-add" });
        break;
      default:
        this.serious_error();
    }
  };

  // vanilla: does not show
  // to-delete: changes back to "vanilla"
  // to-add: deletes row
  this.rr_controls_cancel = function (params) {
    // console.log("cancel");
    // console.log(params);
    switch (params.data["state"]) {
      case "to-delete":
        this.update_row(params.node.id, { state: "vanilla" });
        break;
      case "to-add":
        this.delete_row(params.node.id);
        break;
      default:
        this.serious_error();
    }
  };

  // vanilla: changes to "to-delete"
  // to-delete: does not show
  // to-add: does not show
  this.rr_controls_delete = function (params) {
    // console.log("delete");
    // console.log(params);
    switch (params.data["state"]) {
      case "vanilla":
        this.update_row(params.node.id, { state: "to-delete" });
        break;
      default:
        this.serious_error();
    }
  };

  // new data arrival, merge

  this.new_data_cb = function (data) {
    var new_data_map = {};
    var to_add = [];
    var to_update = [];
    var to_remove = [];

    data.records.forEach((row) => {
      row["state"] = "vanilla";
      row["controls"] = "";
      // row["error"] = "";
      row["natural_sort"] = "";
    });

    if (!this.inited) {
      this.grid_options.rowData = data["records"];
      agGrid.createGrid(this.grid_node, this.grid_options);
    } else {
      // this.api.refreshCells();
      data.records.forEach((row) => {
        var id = row_hash(row);
        new_data_map[id] = row;

        orig_node = this_.api.getRowNode(id);
        if (orig_node) {
          // row exists both in current and new data, merge them
            // to-delete: update, remains to-delete
            // vanilla: update, remains vanilla
            // to-add: delete
          switch (orig_node.data["state"]) {
            case "vanilla":
            case "to-delete":
              var update = {...orig_node.data, "name": row["name"], "class": row["class"], "type": row["type"], "ttl": row["ttl"], "data": row["data"]};
              to_update.push(update);
              break;
            case "to-add":
              to_remove.push({id: id});
              break;
            default:
              this_.serious_error();
          }
        } else {
          // row exists in new data, but not in the current data
            // just add it
          to_add.push(row);
        }
      });

      this.api.forEachNode(function(node) {
        if (!new_data_map.hasOwnProperty(node.id)) {
          // row exists in current data but not in new data
            // to-delete: delete it
            // vanilla: delete it
            // to-add: remains to-add, now change
          switch (node.data["state"]) {
            case "vanilla":
            case "to-delete":
              to_remove.push({id: node.id});
              break;
            case "to-add":
              break;
            default:
              this_.serious_error();
          }
        }
      });

      this.api.applyTransaction({add: to_add, update: to_update, remove: to_remove});
      this.api.redrawRows();

    }

    this.set_error(data["error"]);

    if ("csrftoken" in data) {
      this.csrftoken = data["csrftoken"];
    }

    if ("zone_name" in data) {
      this.set_zone_name(data["zone_name"]);
    }

    Object.keys(this.ddns_param).forEach(function(name) {
      if (name in data) {
        this_.ddns_param[name] = data[name];
      }
    });

    this.stop_reload_animation();
  };

  // main object initialization

  this.main_controls_init();
  this.csrftoken = get_cookie("csrftoken");
}

var zone_editor_obj = new zone_editor("zone_editor_grid", "zone_editor_error", "zone_editor_controls", "zone_editor_help");
