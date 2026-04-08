function zone_editor() {
  this.zone_grid = document.getElementById('zone_grid');
  this.zone_editor_error = document.getElementById('zone_editor_error');
  this.error = "";
  this.data = [];

  this.gridOptions = {
    this.columnDefs,
    this.data,
    defaultColDef: {
      resizable: true,
      flex: 1,
      minWidth: 32
    },
    // KEY: let the grid size itself to its content
    domLayout: 'autoHeight',
    animateRows: true,
    theme: 'legacy',
    onFirstDataRendered: onFirstDataRendered,
    onColumnResized: recalcWidth
  };

  this.columnDefs = [
    { headerName: "name", field: "name", cellClass: "zone-editor-name" },
    { headerName: "class", field: "class", cellClass: "zone-editor-class" },
    { headerName: "type", field: "type", cellClass: "zone-editor-type" },
    { headerName: "ttl", field: "ttl", cellClass: "zone-editor-ttl" },
    { headerName: "data", field: "data", cellClass: "zone-editor-data" }
  ];

  this.refresh_error_div = function() {
    if (typeof data["error"] === 'string' && data["error"].length > 0) {
      zone_editor_error.style.display = "block";
      zone_editor_error.innerHTML = data["error"];
    } else {
      zone_editor_error.style.display = "none";
      zone_editor_error.innerHTML = "";
    }
  }

  this.recalc_width = function(params) {
    if (this.data.length === 0)
      return;

    const cols = params.api.getColumns();
    let total = 0;
    cols.forEach(c => total += c.getActualWidth());
    // const padding = 16; // scrollbar / safety
    const padding = 0;
    new_width = (total + padding) + 'px';
    this.zone_grid.style.width = new_width;
  }

  this.on_first_data_rendered = function(params) {
    if (this.data.length === 0)
      return;

    // autosize every column based on cell contents (skipHeader = true reduces header influence)
    const cols = params.api.getColumns();
    const colIds = cols.map(c => c.getId());
    params.api.autoSizeColumns(colIds, /*skipHeader=*/ true);
    this.recalc_width(params);
  }

  this.new_data_cb() = function(data) {
    this.data = data["records"];
    this.error = data["error"];
    this.refresh_error_div();
  }

  this.refresh_error_div();
  agGrid.createGrid(zone_grid, gridOptions);
}

var zone_editor_obj = new zone_editor();
