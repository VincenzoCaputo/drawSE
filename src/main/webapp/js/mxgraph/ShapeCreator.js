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

  var connectionsNode = this.xmlDoc.createElement('connections');

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
      if(shape.isOutlineConstraint()) {
        connectionsNode.appendChild(this.createLineConstraintNode(shape, shape, groupProp));
      }
    }else if(shapeType == shape.STENCIL_SHAPE_TYPE) {
      fgNode.appendChild(this.createSubStencilNode(shape, groupProp));
      if(shape.isOutlineConstraint()) {
        connectionsNode.appendChild(this.createStencilOutlineConstraintNode(shape, groupProp));
      }
    } else if(shapeType == shape.CURVE_SHAPE_TYPE) {
      fgNode.appendChild(this.createCurveNode(shape, groupProp));
      if(shape.isOutlineConstraint()) {
        connectionsNode.appendChild(this.createCurveConstraintNode(shape, shape, groupProp));
      }
    } else if(shapeType == shape.TEXT_SHAPE_TYPE) {
      vertex.push(shape); //Aggiungo lo shape all'array delle celle da raggruppare
      delete cellGroup[cellIndex]; //Rimuovo lo shape dal gruppo in modo tale da non eliminarlo dal graph successivamente
    }
    if(this.graph.getCellStyle(shape)[mxConstants.STYLE_DASHED]) {
      var dashedNode = this.xmlDoc.createElement('dashed');
      dashedNode.setAttribute('dashed', '1');
      fgNode.appendChild(dashedNode);
      var dashedPattern = this.graph.getCellStyle(shape)[mxConstants.STYLE_FIX_DASH];
      if(dashedPattern!=null) {
        var dashPatternNode = this.xmlDoc.createElement('dashpattern');
        dashPatternNode.setAttribute('pattern', dashedPattern);
        fgNode.appendChild(dashPatternNode);
      }
    }
    //Per lo spessore della linea
    var strokeWidth = this.graph.getCellStyle(shape)[mxConstants.STYLE_STROKEWIDTH];
    if(strokeWidth!=null) {
      var strokeWidthNode = this.xmlDoc.createElement('strokewidth');
      strokeWidthNode.setAttribute('width', strokeWidth);
      fgNode.appendChild(strokeWidthNode);
    }
    //Per il colore di contorno
    var strokeColorNode = this.xmlDoc.createElement('strokecolor');
    strokeColorNode.setAttribute('color',this.graph.getCellStyle(shape)[mxConstants.STYLE_STROKECOLOR]);
    fgNode.appendChild(strokeColorNode);

    //Per il colore di riempimento
    var fillColor=this.graph.getCellStyle(shape)[mxConstants.STYLE_FILLCOLOR];
    if(fillColor!=null) {
      var fillColorNode = this.xmlDoc.createElement('fillcolor');
      fillColorNode.setAttribute('color',fillColor);
      fgNode.appendChild(fillColorNode);
      fgNode.appendChild(this.xmlDoc.createElement('fillstroke'));
    } else {
      fgNode.appendChild(this.xmlDoc.createElement('stroke'));
    }

    //Aggiungo eventuali punti di attacco attached
    if(shape.getChildCount()>0) {
      var attachedPoints = shape.children;
      for(j=0; j<attachedPoints.length; j++) {
        var constraintNode;
        if(attachedPoints[j].style.includes('ellipse')) {
          constraintNode = this.createPointConstraintNode(shape, attachedPoints[j], groupProp);
        } else if(attachedPoints[j].edge) {
          if(attachedPoints[j].getShapeType()==shape.LINE_SHAPE_TYPE) {
            constraintNode = this.createLineConstraintNode(shape, attachedPoints[j], groupProp);
          } else if(attachedPoints[j].getShapeType() == shape.CURVE_SHAPE_TYPE) {
            constraintNode = this.createCurveConstraintNode(shape, attachedPoints[j], groupProp);
          }
        }
        connectionsNode.appendChild(constraintNode);
      }
    }
  }
  root.appendChild(connectionsNode);
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
  if(this.graph.getCellStyle(shape)[mxConstants.STYLE_ROUNDED]=='1') {
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
  var shapeName = this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE];
  if(shapeName=='mxgraph.general.rectangle') {
    includeShapeNode = this.xmlDoc.createElement('rect');
  } else if(shapeName=='mxgraph.general.circle') {
    includeShapeNode = this.xmlDoc.createElement('ellipse');
  } else {
    includeShapeNode = this.xmlDoc.createElement('include-shape');
    includeShapeNode.setAttribute('name', shapeName);
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
 * Questo metodo restituisce un nodo XML rappresentante un punto di attacco
 */
ShapeCreator.prototype.createPointConstraintNode = function(shape, point, groupProp) {
  var constraintNode = this.xmlDoc.createElement('constraint');
  var attachedPointGeo = point.getGeometry();
  /*Se il simbolo è uno stencil il punto di attacco è posizionato rispetto al simbolo e non al foglio di lavoro
    Pertanto va prima traslato
  */
  if(shape.shapeType == mxCell.STENCIL_SHAPE_TYPE) {
    attachedPointGeo.x = attachedPointGeo.x + shape.getGeometry().x;
    attachedPointGeo.y = attachedPointGeo.y + shape.getGeometry().y;
  }
  var x = ((attachedPointGeo.x+attachedPointGeo.width/2)-groupProp.x)/groupProp.w;
  var y = ((attachedPointGeo.y+attachedPointGeo.height/2)-groupProp.y)/groupProp.h;

  constraintNode.setAttribute('x', x);
  constraintNode.setAttribute('y', y);
  constraintNode.setAttribute('name',point.getAttribute('constraintName',''));
  constraintNode.setAttribute('perimeter',0);

  return constraintNode;
}

ShapeCreator.prototype.createLineConstraintNode = function(shape, line, groupProp) {
  var points = line.getAllPoints();
  var constraintNodes = this.xmlDoc.createDocumentFragment();
  for(i=0; i<points.length-1; i++) {
    var x1 = points[i].x;
    var y1 = points[i].y;
    var x2 = points[i+1].x;
    var y2 = points[i+1].y;
    //Devo traslare se il parent è uno stencil
    if(shape.shapeType == mxCell.STENCIL_SHAPE_TYPE) {
      x1 = x1 + shape.getGeometry().x;
      y1 = y1 + shape.getGeometry().y;
      x2 = x2 + shape.getGeometry().x;
      y2 = y2 + shape.getGeometry().y;
    }
    //Setto la posizione relativa allo stencil da creare
    var x1 = (x1-groupProp.x);
    var y1 = (y1-groupProp.y);
    var x2 = (x2-groupProp.x);
    var y2 = (y2-groupProp.y);
    //calcolo coefficiente angolare
    var m = (y2 - y1) / (x2 - x1);
    //calcolo quota all'origine
    var c = y1 - x1 * m;
    //Se la distanza tra y2 e y1 è maggiore della distanza tra x2 e x1, valuto le x per ogni y
    if(Math.abs(x2-x1)<Math.abs(y2-y1)) {
      //Considero y1 come il punto più vicino all'origine
      if(y1>y2) {
        var t=y2;
        y2 = y1;
        y1 = t;
      }
      for(y=y1; y<y2; y=y+2) {
        var constraintNode = this.xmlDoc.createElement('constraint');
        //Se x2=x1 allora il coefficiente angolare non c'è (avremo una linea verticale)
        if(x2!=x1) {
          var x = (y-c)/m;
        } else {
          var x = x1;
        }
        constraintNode.setAttribute('x', x/groupProp.w);
        constraintNode.setAttribute('y', y/groupProp.h);
        constraintNode.setAttribute('name',line.getAttribute('constraintName',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
    } else {
      if(x1>x2) {
        var t=x2;
        x2 = x1;
        x1 = t;
      }
      for(x=x1; x<x2; x=x+2) {
        var y = m*x+c;
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', x/groupProp.w);
        constraintNode.setAttribute('y', y/groupProp.h);
        constraintNode.setAttribute('name',line.getAttribute('constraintName',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
    }
  }
  return constraintNodes;
}

ShapeCreator.prototype.createCurveConstraintNode = function(shape, curve, groupProp) {
  var points = curve.getAllPoints();
  var constraintNodes = this.xmlDoc.createDocumentFragment();
  var relativeP = [];
  for(i=0; i<points.length; i++) {
    var p = {x:0,y:0};
    if(shape.shapeType == mxCell.STENCIL_SHAPE_TYPE) {
      p.x = points[i].x + shape.getGeometry().x;
      p.y = points[i].y + shape.getGeometry().y;
    }
    p.x = (p.x-groupProp.x);
    p.y = (p.y-groupProp.y);
    relativeP.push(p);
  }

  if(points.length==2) {
    return createLineConstraintNode(shape, curve, groupProp);
  } else if(points.length==3) {
    for(i=0; i<1; i=i+0.02) {
      var p = this.getPointOnQuadCurve(i, relativeP[0], relativeP[1], relativeP[2]);
      var constraintNode = this.xmlDoc.createElement('constraint');
      constraintNode.setAttribute('x', p.x/groupProp.w);
      constraintNode.setAttribute('y', p.y/groupProp.h);
      constraintNode.setAttribute('name',curve.getAttribute('constraintName',''));
      constraintNode.setAttribute('perimeter',0);
      constraintNodes.appendChild(constraintNode);
    }
    return constraintNodes;
  } else {
    var j;
    var prexc = relativeP[0].x;
    var preyc = relativeP[0].y;
    for(j=1; j<points.length-2; j++) {
      for(i=0; i<1; i=i+0.02) {
        var xc = (relativeP[j].x+relativeP[j+1].x)/2;
        var yc = (relativeP[j].y+relativeP[j+1].y)/2;
        var p = this.getPointOnQuadCurve(i, {x: prexc, y: preyc}, relativeP[j], {x:xc, y:yc});
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', p.x/groupProp.w);
        constraintNode.setAttribute('y', p.y/groupProp.h);
        constraintNode.setAttribute('name',curve.getAttribute('constraintName',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
      prexc = xc;
      preyc = yc;
    }
    for(i=0; i<1; i=i+0.02) {
      var xc = (relativeP[j-1].x+relativeP[j].x)/2;
      var yc = (relativeP[j-1].y+relativeP[j].y)/2;
      var p = this.getPointOnQuadCurve(i, {x:xc, y:yc}, relativeP[j], relativeP[j+1]);
      var constraintNode = this.xmlDoc.createElement('constraint');
      constraintNode.setAttribute('x', p.x/groupProp.w);
      constraintNode.setAttribute('y', p.y/groupProp.h);
      constraintNode.setAttribute('name',curve.getAttribute('constraintName',''));
      constraintNode.setAttribute('perimeter',0);
      constraintNodes.appendChild(constraintNode);
    }
    return constraintNodes;
  }
}

ShapeCreator.prototype.createStencilOutlineConstraintNode = function(shape, groupProp) {
    var geo = shape.getGeometry();
    var constraintNodes = this.xmlDoc.createDocumentFragment();
    if(this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE]=='mxgraph.general.rectangle') {
      var x = geo.x-groupProp.x;
      var y = geo.y-groupProp.y;
      console.log(y);
      for(i=x; i<geo.width; i=i+2) {
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', i/groupProp.w);
        constraintNode.setAttribute('y', y/groupProp.h);
        constraintNode.setAttribute('name',shape.getAttribute('constraintName',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);

        constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', i/groupProp.w);
        constraintNode.setAttribute('y', geo.height/groupProp.h);
        constraintNode.setAttribute('name',shape.getAttribute('constraintName',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }

      for(i=y; i<geo.height; i=i+2) {
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', x/groupProp.w);
        constraintNode.setAttribute('y', i/groupProp.h);
        constraintNode.setAttribute('name',shape.getAttribute('constraintName',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);

        constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', geo.width/groupProp.w);
        constraintNode.setAttribute('y', i/groupProp.h);
        constraintNode.setAttribute('name',shape.getAttribute('constraintName',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
    } else if(this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE]=='mxgraph.general.circle') {
      for(i=0; i<4*Math.PI; i=i+0.05) {
        console.log(i);
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', ((((geo.width/2)*Math.cos(i)))+geo.width/2)/groupProp.w);
        constraintNode.setAttribute('y', ((((geo.height/2)*Math.sin(i)))+geo.height/2)/groupProp.h);
        constraintNode.setAttribute('name',shape.getAttribute('constraintName',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
    }
    return constraintNodes;
}

ShapeCreator.prototype.getPointOnQuadCurve = function(t, p1, p2, p3) {
	var t2 = (1-t)*(1-t);
	var t3 = 2*(1-t)*t;
	var t4 = t*t;
	var x = t2 * p1.x + t3 * p2.x + t4 * p3.x;
	var y = t2 * p1.y + t3 * p2.y + t4 * p3.y;
	return ({x: x,y: y});
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

mxCell.prototype.CURVE_SHAPE_TYPE = 'curve';
mxCell.prototype.STENCIL_SHAPE_TYPE = 'stencil';
mxCell.prototype.LINE_SHAPE_TYPE = 'line';
mxCell.prototype.TEXT_SHAPE_TYPE = 'text';
