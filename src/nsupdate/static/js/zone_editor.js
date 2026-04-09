function zone_editor(grid_id, error_id, controls_id) {
  function is_nonemptystring(str) {
    return typeof str === 'string' && str.length > 0;
  }

  var rndsep = Math.floor(Math.random() * 9e6).toString(36);

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

  function row_hash(row) {
    data = row.data
    data_str = [data["name"], data["class"], data["type"], data["ttl"], data["data"]].join(rndsep);
    // serialized_row = Object.keys(data).sort().map(k => `${k}:${data[k]}`).join(',');
    uint32_hash = hash32(data_str);
    str_hash = uint32_to_base64(uint32_hash);
    return str_hash;
  }

  this.grid_node = document.getElementById(grid_id);
  this.error_node = document.getElementById(error_id);
  this.controls_node = document.getElementById(controls_id);
  this.error = "";
  this.api = false;
  this.inited = false;

  this_ = this;
  this.controls_node.addEventListener('click', function() { this_.reload_clicked(); });

  this.grid_options = {
    columnDefs: [
      { headerName: "name", field: "name", cellClass: "zone-editor-name" },
      { headerName: "class", field: "class", cellClass: "zone-editor-class" },
      { headerName: "type", field: "type", cellClass: "zone-editor-type" },
      { headerName: "ttl", field: "ttl", cellClass: "zone-editor-ttl" },
      { headerName: "data", field: "data", cellClass: "zone-editor-data" },
      { headerName: "state", field: "state", cellClass: "zone-editor-state" },
      { headerName: "controls", field: "controls", cellClass: "zone-editor-controls",
        cellRenderer: function(params) { return this_.control_cell_html(params); }
      },
      { headerName: "error", field: "error", cellClass: "zone-editor-error" }
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
    },
    getRowId: function(row) {
      id = row_hash(row);
      console.log(JSON.stringify(row.data) + " " + id);
      return id;
    },
    getRowClass: function(params) {
      row_class = "ag-row-" + params.data.state;
      if (is_nonemptystring(params.data.error)) {
        row_class = [row_class, "row-error"];
      }
      return row_class;
    }
  };

  this.set_error = function(error) {
    console.log("set_error: " + error);
    this.error = error;
    if (is_nonemptystring(this.error)) {
      zone_editor_error.style.display = "block";
      zone_editor_error.innerHTML = this.error;
    } else {
      zone_editor_error.style.display = "none";
      zone_editor_error.innerHTML = "";
    }
  }

  this.recalc_width = function(params) {
    this.params = params;
    if (this.grid_options.rowData.length === 0)
      return;

    const cols = params.api.getColumns();
    let total = 0;
    cols.forEach(c => total += c.getActualWidth());
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

  this.reload_clicked = function() {
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
  };

  this.new_data_cb = function(data) {
    data.records.forEach(row => {
      row["state"] = "vanilla";
      row["controls"] = "";
      row["error"] = "";
    });
    this.grid_options.rowData = data["records"];
    this.set_error(data["error"]);
    this.stop_dl_animation();
    if (this.inited) {
      this.api.refreshCells();
    } else {
      agGrid.createGrid(this.grid_node, this.grid_options);
    }
  },
  this.control_cell_html = function(params) {
    var buttons=[
      ['delete', this_.on_control_click_delete],
      ['clone', this_.on_control_click_clone],
      ['edit', this_.on_control_click_edit],
      ['cancel', this_.on_control_click_cancel]
    ];
    var el = document.createElement('span');
    for (button of buttons) {
      var button_node = document.createElement('button');
      var button_name = button[0];
      var button_onclick = button[1];
      el.append(button_node, ' ');
      button_node.type = 'button';
      button_node.textContent = button_name;
      button_node.classList.add('btn', 'btn-xs', 'btn-primary', 'zone-editor-btn-' + button_name);
      button_node.addEventListener(button[0], function(params) { button_onclick.bind(this_)(params); });
    }
    return el;
    return `<button class="btn btn-xs btn-primary">cica</button>
    <button class="btn btn-xs btn-primary">cica2</button>`;
  },
  this.on_control_click_edit = function(params) {
    console.log("edit");
  }
  this.on_control_click_cancel  = function(params) {
    console.log("cancel");
  }
  this.on_control_click_clone = function(params) {
    console.log("clone");
  }
  this.on_control_click_delete = function(params) {
    console.log("delete");
  }
}

var zone_editor_obj = new zone_editor('zone_editor_grid', 'zone_editor_error', 'zone_editor_controls');
