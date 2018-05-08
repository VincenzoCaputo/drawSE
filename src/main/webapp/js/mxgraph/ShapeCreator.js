/**
 * Istanzianzione della classe ShapeCreator, che permette di creare uno
 * stencil definito da un documento XML, dato un nome (per lo shape) e il graph
 * di riferimento.
*/
function ShapeCreator(graph) {
  this.graph = graph;
}

/**
  Questo metodo restuisce la dimensione di una selezione di uno o più elementi.
  @param group elementi selezionati
  @return oggetto contente le coordinate (x e y), e le dimensioni (w e h)
*/
ShapeCreator.prototype.getSizeAndPosition = function (group) {
  var cellBounds = this.graph.view.getState(group[0]).getCellBounds();

  var maxX = cellBounds.x+cellBounds.width;
  var maxY = cellBounds.y+cellBounds.height;
  var minX = cellBounds.x;
  var minY = cellBounds.y;

  //Calcolo le coordinate massime e minime
  for(i=1; i<group.length; i++) {
    var cb = this.graph.view.getState(group[i]).getCellBounds();

    if(cb.x+cb.width > maxX) {
      maxX = cb.x+cb.width;
    }
    if(cb.x < minX) {
      minX = cb.x;
    }
    if(cb.y+cb.height > maxY) {
      maxY = cb.y+cb.height;
    }
    if(cb.y < minY) {
      minY = cb.y;
    }

  }
  return {x: minX, y: minY, w: maxX-minX, h: maxY-minY};
}

/**
  Crea uno Stencil definito da un documento XML dato un array di cells e lo aggiunge al graph.
  @param cellGroup array di cells
*/
ShapeCreator.prototype.mergeShapes = function(cellGroup) {
  var groupProp = this.getSizeAndPosition(cellGroup);

  //Creo il documento XML per lo shape
  this.xmlDoc = mxUtils.createXmlDocument();
  var root = this.xmlDoc.createElement('shape');
  root.setAttribute('h',groupProp.h);
  root.setAttribute('w',groupProp.w);
  root.setAttribute('aspect','fixed');
  root.setAttribute('strokewidth','inherit');
  this.xmlDoc.appendChild(root);

  var fgNode = this.xmlDoc.createElement('foreground');
  fgNode.appendChild(this.xmlDoc.createElement('fillstroke'));
  //Creo un array in cui inserire le celle da raggruppare e che costituiranno lo shape finale
  var vertex = new Array();
  //Per ogni cella della selezione
  for(cellIndex in cellGroup) {
    var shape = cellGroup[cellIndex];
    //Ricavo il tipo di shape
    var shapeType = shape.getShapeType();
    if(shapeType == shape.LINE_SHAPE_TYPE){
      //Aggiungo un nodo path
      fgNode.appendChild(this.createLineNode(shape, groupProp));

    }else if(shapeType == shape.STENCIL_SHAPE_TYPE) {
      fgNode.appendChild(this.createSubStencilNode(shape, groupProp));
    } else if(shapeType == shape.CURVE_SHAPE_TYPE) {
      fgNode.appendChild(this.createCurveNode(shape, groupProp));
    } else if(shapeType == shape.TEXT_SHAPE_TYPE) {
      vertex.push(shape); //Aggiungo lo shape all'array delle celle da raggruppare
      delete cellGroup[cellIndex]; //Rimuovo lo shape dal gruppo in modo tale da non eliminarlo dal graph successivamente
    }
    if(shape.isDashed()) {
      var dashedNode = this.xmlDoc.createElement('dashed');
      dashedNode.setAttribute('dashed', '1');
      fgNode.appendChild(dashedNode);
      if(shape.getDashedPattern()!=null) {
        var dashPatternNode = this.xmlDoc.createElement('dashpattern');
        dashPatternNode.setAttribute('pattern', shape.getDashedPattern());
        fgNode.appendChild(dashPatternNode);
      }
    }
    //Per lo spessore della linea
    var strokeWidth = shape.getStrokeWidth();
    if(strokeWidth!=null) {
      var strokeWidthNode = this.xmlDoc.createElement('strokewidth');
      strokeWidthNode.setAttribute('width', strokeWidth);
      fgNode.appendChild(strokeWidthNode);
    }
    //Per il colore di contorno
    var strokeColorNode = this.xmlDoc.createElement('strokecolor');
    strokeColorNode.setAttribute('color',shape.getStrokeColor());
    fgNode.appendChild(strokeColorNode);

    //Per il colore di riempimento
    var fillColor=shape.getFillColor();
    if(fillColor!=null) {
      var fillColorNode = this.xmlDoc.createElement('fillcolor');
      fillColorNode.setAttribute('color',fillColor);
      fgNode.appendChild(fillColorNode);
      fgNode.appendChild(this.xmlDoc.createElement('fillstroke'));
    } else {
      fgNode.appendChild(this.xmlDoc.createElement('stroke'));
    }

  }
  root.appendChild(fgNode);

  this.graph.getModel().beginUpdate();
  try {
    var xmlBase64 = this.graph.compress(mxUtils.getPrettyXml(root));
    var v1 = this.graph.insertVertex(this.graph.getDefaultParent(), null, null, groupProp.x, groupProp.y, groupProp.w, groupProp.h, 'shape=stencil('+xmlBase64+');');

    this.graph.removeCells(cellGroup);

    vertex.push(v1);
    if(vertex.length>1) {
      this.graph.setSelectionCell(this.graph.groupCells(null, 0, vertex.reverse()));
    }
  } finally {
    this.graph.getModel().endUpdate();
  }
}

/**
  Questo metodo crea un nodo XML che descrive una retta spezzata.
  @param shape rappresentazione grafica della linea
  @param groupProp proprietà della selezione degli elementi
  @return nodo xml che descrive il path della retta.
*/
ShapeCreator.prototype.createLineNode = function(shape, groupProp) {
  var pathNode = this.xmlDoc.createElement('path');
  var points = shape.getAllPoints();

  //Creo un nodo move per spostarmi alla posizione sorgente della linea
  var moveNode = this.xmlDoc.createElement('move');
  moveNode.setAttribute('x',points[0].x-groupProp.x);
  moveNode.setAttribute('y',points[0].y-groupProp.y);
  pathNode.appendChild(moveNode);
  //Per ogni punto intermedio aggiungo una linea
  //Se gli angoli delle linee sono arrotondate utilizzo delle curve di bezier quadratiche agli angoli
  if(shape.isRounded()) {
    var t = 0.89;
    for(i=1; i<points.length-1; i++) {
      var lineNode = this.xmlDoc.createElement('line');
      lineNode.setAttribute('x',(1-t)*(points[i-1].x-groupProp.x)+t*(points[i].x-groupProp.x));
      lineNode.setAttribute('y',(1-t)*(points[i-1].y-groupProp.y)+t*(points[i].y-groupProp.y));
      pathNode.appendChild(lineNode);
      var quadNode = this.xmlDoc.createElement('quad');
      quadNode.setAttribute('x1', points[i].x-groupProp.x);
      quadNode.setAttribute('y1', points[i].y-groupProp.y);
      quadNode.setAttribute('x2', t*(points[i].x-groupProp.x)+(1-t)*(points[i+1].x-groupProp.x));
      quadNode.setAttribute('y2', t*(points[i].y-groupProp.y)+(1-t)*(points[i+1].y-groupProp.y));
      pathNode.appendChild(quadNode);
    }
    var lineNode = this.xmlDoc.createElement('line');
    lineNode.setAttribute('x', points[i].x-groupProp.x);
    lineNode.setAttribute('y', points[i].y-groupProp.y);
    pathNode.appendChild(lineNode);
  } else {
    for(i=1; i<points.length; i++) {
      var lineNode = this.xmlDoc.createElement('line');
      lineNode.setAttribute('x',points[i].x-groupProp.x);
      lineNode.setAttribute('y',points[i].y-groupProp.y);
      pathNode.appendChild(lineNode);
    }
  }

  return pathNode;
}

/**
  Questo metodo crea un nodo XML che descrive uno stencil già esistente.
  @param shape rappresentazione grafica della linea
  @param groupProp proprietà della selezione degli elementi
  @return nodo xml che descrive la figura.
*/
ShapeCreator.prototype.createSubStencilNode = function(shape, groupProp) {
  var includeShapeNode;
  var shapeState = this.graph.view.getState(shape);
  if(shape.getShapeName()=='mxgraph.general.rectangle') {
    includeShapeNode = this.xmlDoc.createElement('rect');
  } else if(shape.getShapeName()=='mxgraph.general.circle') {
    includeShapeNode = this.xmlDoc.createElement('ellipse');
  } else {
    includeShapeNode = this.xmlDoc.createElement('include-shape');
    includeShapeNode.setAttribute('name', shape.getShapeName());
  }
  includeShapeNode.setAttribute('x', shapeState.origin.x-groupProp.x);
  includeShapeNode.setAttribute('y', shapeState.origin.y-groupProp.y);

  includeShapeNode.setAttribute('w', shapeState.width);
  includeShapeNode.setAttribute('h', shapeState.height);

  return includeShapeNode;
}

/**
  Questo metodo crea un nodo XML che descrive una curva.
  @param shape rappresentazione grafica della linea
  @param groupProp proprietà della selezione degli elementi
  @return nodo xml che descrive il path della curva.
*/
ShapeCreator.prototype.createCurveNode = function(shape, groupProp) {
  //Aggiungo un nodo path
  var pathNode = this.xmlDoc.createElement('path');
  var points = shape.getAllPoints();
  var moveNode = this.xmlDoc.createElement('move');
  moveNode.setAttribute('x',points[0].x-groupProp.x);
  moveNode.setAttribute('y',points[0].y-groupProp.y);
  pathNode.appendChild(moveNode);
  //Se ha solo due punti, in realtà è un segmento
  if(points.length==2) {
    pathNode = this.createLineNode(shape, groupProp);
  }else if(points.length==3) { //Se la curva ha un solo punto di controllo, uso un nodo quad
    var quadNode = this.xmlDoc.createElement('quad');
    quadNode.setAttribute('x1',points[1].x-groupProp.x);
    quadNode.setAttribute('y1',points[1].y-groupProp.y);
    quadNode.setAttribute('x2',points[2].x-groupProp.x);
    quadNode.setAttribute('y2',points[2].y-groupProp.y);
    pathNode.appendChild(quadNode);
  } else {
    var i;
    for(i=1; i<points.length-2; i++) {
      var quadNode = this.xmlDoc.createElement('quad');
      var xc = (points[i].x-groupProp.x + points[i + 1].x-groupProp.x) / 2;
      var yc = (points[i].y-groupProp.y + points[i + 1].y-groupProp.y) / 2;
      quadNode.setAttribute('x1',points[i].x-groupProp.x);
      quadNode.setAttribute('y1',points[i].y-groupProp.y);
      quadNode.setAttribute('x2',xc);
      quadNode.setAttribute('y2',yc);
      pathNode.appendChild(quadNode);
    }
    var quadNode = this.xmlDoc.createElement('quad');
    quadNode.setAttribute('x1',points[i].x-groupProp.x);
    quadNode.setAttribute('y1',points[i].y-groupProp.y);
    quadNode.setAttribute('x2',points[i+1].x-groupProp.x);
    quadNode.setAttribute('y2',points[i+1].y-groupProp.y);
    pathNode.appendChild(quadNode);
  }
  return pathNode;
}

/**
  Questo metodo restituisce tutti i punti di un mxCell.
  @return array di punti dell'mxCell.
*/
mxCell.prototype.getAllPoints = function() {
  var pointsArr = new Array();
  pointsArr.push(this.getGeometry().sourcePoint);
  var controlPoints = this.getGeometry().points;
  for(p in controlPoints) {
    pointsArr.push(controlPoints[p]);
  }
  pointsArr.push(this.getGeometry().targetPoint);
  return pointsArr;
}

/**
  Questo metodo restituisce il tipo di mxCell (curva, stencil o linea)
  @return tipo di mxCell.
*/
mxCell.prototype.getShapeType = function() {
  if(this.getStyle().includes('curved=1')) {
    return this.CURVE_SHAPE_TYPE;
  } else if(this.getStyle().includes('shape=')) {
    return this.STENCIL_SHAPE_TYPE;
  } else if(this.getStyle().includes('text')) {
    return this.TEXT_SHAPE_TYPE;
  }
  return this.LINE_SHAPE_TYPE;
}

/**
  Questo metodo restituisce il nome dello stencil.
  @return nome dello stencil.
*/
mxCell.prototype.getShapeName = function() {
  var styleArray = this.getStyle().split(';');
  var shapeName = styleArray.find(function(attr){
    return attr.includes('shape=');
  });
  return shapeName.split('=')[1];
}

/**
  Questo metodo restituisce la dimensione dello spessore del contorno.
  @return dimensione contorno.
*/
mxCell.prototype.getStrokeWidth = function() {
  var styleArray = this.getStyle().split(';');
  var strokeWidth = styleArray.find(function(attr){
    return attr.includes('strokeWidth=');
  });
  if(strokeWidth!=null) {
    return strokeWidth.split('=')[1];
  } else {
    return null;
  }
}

/**
  Questo metodo restituisce il pattern tratteggiato del mxCell.
  @return pattern
*/
mxCell.prototype.getDashedPattern = function() {
  var styleArray = this.getStyle().split(';');
  var dashedPattern = styleArray.find(function(attr){
    return attr.includes('dashPattern=');
  });
  if(dashedPattern!=null) {
    return dashedPattern.split('=')[1];
  } else {
      return null;
  }
}

/**
  Questo metodo controlla se il contorno è tratteggiato.
  @return true se è tratteggiato, false altrimenti.
*/
mxCell.prototype.isDashed = function() {
  var styleArray = this.getStyle().split(';');
  var dashed = styleArray.find(function(attr){
    return attr.includes('dashed=');
  });
  if(dashed!=null && dashed.split('=')[1]=='1') {
    return true;
  } else {
    return false;
  }
}

/**
  Questo metodo controlla se lo shape ha l'attributo rounded nello style
  @return true se è rounded, false altrimenti.
*/
mxCell.prototype.isRounded = function() {
  var styleArray = this.getStyle().split(';');
  var rounded = styleArray.find(function(attr){
    return attr.includes('rounded=');
  });
  if(rounded!=null && rounded.split('=')[1]=='1') {
    return true;
  } else {
    return false;
  }
}
/**
  Questo metodo restituisce il colore di contorno di un mxCell.
  @return null se non è presente alcun colore altrimenti colore di contorno
*/
mxCell.prototype.getStrokeColor = function() {
  var styleArray = this.getStyle().split(';');
  var shapeColor = styleArray.find(function(attr){
    return attr.includes('strokeColor=');
  });
  if(shapeColor!=null) {
    return shapeColor.split('=')[1];
  } else {
    return '#000000';
  }
}

/**
  Questo metodo restituisce il colore di riempimento di un mxCell.
  @return null se non è presente alcun colore altrimenti colore di riempimento.
*/
mxCell.prototype.getFillColor = function() {
  var styleArray = this.getStyle().split(';');
  var shapeColor = styleArray.find(function(attr){
    return attr.includes('fillColor=');
  });
  if(shapeColor!=null) {
    return shapeColor.split('=')[1];
  } else {
    return null;
  }

}

mxCell.prototype.CURVE_SHAPE_TYPE = 'curve';
mxCell.prototype.STENCIL_SHAPE_TYPE = 'stencil';
mxCell.prototype.LINE_SHAPE_TYPE = 'line';
mxCell.prototype.TEXT_SHAPE_TYPE = 'text';
