function zoneJsonCallback(data) {

  const columnDefs = [
    { headerName: "name", field: "name", cellClass: "zone-editor-name" },
    { headerName: "class", field: "class", cellClass: "zone-editor-class" },
    { headerName: "type", field: "type", cellClass: "zone-editor-type" },
    { headerName: "ttl", field: "ttl", cellClass: "zone-editor-ttl" },
    { headerName: "data", field: "data", cellClass: "zone-editor-data" }
  ];

  const rowData = data

  function recalcWidth(params) {
    const cols = params.api.getColumns();

    let total = 0;
    cols.forEach(c => total += c.getActualWidth());
    const padding = 16; // scrollbar / safety
    document.getElementById('myGrid').style.width = (total + padding) + 'px';
  }

  function onFirstDataRendered(params) {
    // autosize every column based on cell contents (skipHeader = true reduces header influence)
    const cols = params.api.getColumns();
    const colIds = cols.map(c => c.getId());
    params.api.autoSizeColumns(colIds, /*skipHeader=*/ true);
    recalcWidth(params);
  }

  const gridOptions = {
    columnDefs,
    rowData,
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

  const eGridDiv = document.querySelector('#myGrid');
  agGrid.createGrid(eGridDiv, gridOptions);

  // Example: if you later change rows and want the grid to resize, set new row data:
  // gridOptions.api.setRowData(newRowData);
  //
  // If row heights change dynamically (e.g. auto height rows or cell wrapping),
  // you can call:
  // gridOptions.api.resetRowHeights();

}
