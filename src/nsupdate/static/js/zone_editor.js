function zone_editor(grid_id, error_id, controls_id) {
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
      { headerName: "data", field: "data", cellClass: "zone-editor-data" }
    ],
    rowData: false,
    defaultColDef: {
      resizable: true,
      flex: 1,
      minWidth: 32
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
    }
  };

  this.set_error = function(error) {
    this.error = error;
    if (typeof this.error === 'string' && this.error.length > 0) {
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
        this_.new_data_cb(response.json());
        this_.set_error(false);
      })
      .catch(function(err) {
        this_.stop_dl_animation();
        this_.set_error(err);
      });
  };

  this.new_data_cb = function(data) {
    this.grid_options.rowData = data["records"];
    this.set_error(data["error"]);
    this.stop_dl_animation();
    if (this.inited) {
      this.api.refreshCells();
    } else {
      agGrid.createGrid(this.grid_node, this.grid_options);
    }
  }
}

var zone_editor_obj = new zone_editor('zone_editor_grid', 'zone_editor_error', 'zone_editor_controls');
