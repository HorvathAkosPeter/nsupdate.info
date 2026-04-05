function zoneJsonCallback(data) {

  const columnDefs = [
    { headerName: "name", field: "name" },
    { headerName: "ttl", field: "ttl" },
    { headerName: "class", field: "class" },
    { headerName: "type", field: "type" },
    { headerName: "data", field: "data" }
  ];

  const rowData = data

  const gridOptions = {
    columnDefs,
    rowData,
    defaultColDef: { resizable: true, flex: 1, minWidth: 100 },
    // KEY: let the grid size itself to its content
    domLayout: 'autoHeight',
    animateRows: true,
    theme: 'legacy'
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
