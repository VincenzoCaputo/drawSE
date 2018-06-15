/**
 * Istanzianzione della classe ShapeCreator, che permette di creare uno
 * stencil definito da un documento XML, dato il graph di riferimento.
*/
function ShapeCreator(graph) {
  this.graph = graph;
}

/**
  Crea uno Stencil definito da un documento XML dato un array di cells e lo aggiunge al graph.
  @param cellGroup array di cells
  @param stroke true se aggiungere lo sfondo alle linee spezzate, false altrimenti
  @param isPath true per creare un path unico per le linee, false altrimenti
*/
ShapeCreator.prototype.mergeShapes = function(cellGroup, stroke, isPath) {
  var groupProp = this.getSizeAndPosition(cellGroup);

  //Creo il documento XML per lo shape
  this.xmlDoc = mxUtils.createXmlDocument();
  //Definisco il tag radice
  var root = this.xmlDoc.createElement('shape');
  root.setAttribute('h',groupProp.h);
  root.setAttribute('w',groupProp.w);
  root.setAttribute('aspect','fixed');
  root.setAttribute('strokewidth','inherit');
  this.xmlDoc.appendChild(root);
  //Definisco i due tag figli
  var connectionsNode = this.xmlDoc.createElement('connections');
  var fgNode = this.xmlDoc.createElement('foreground');
  fgNode.appendChild(this.xmlDoc.createElement('fillstroke'));
  //Creo un array in cui inserire le celle da raggruppare e che costituiranno lo shape finale
  var vertex = new Array();
  if(isPath) { //Per creare un unico path di linee
    var path = this.getPathXml(cellGroup, groupProp, stroke);
    fgNode.appendChild(path);
    fgNode.appendChild(this.xmlDoc.createElement('fillstroke'));
  } else {
    //Per ogni cella della selezione
    for(cellIndex in cellGroup) {
      var shape = cellGroup[cellIndex];
      var shapeType = shape.getShapeType();
      if(shapeType == shape.TEXT_SHAPE_TYPE) {
        vertex.push(shape); //Aggiungo lo shape all'array delle celle da raggruppare
        delete cellGroup[cellIndex]; //Rimuovo lo shape dal gruppo in modo tale da non eliminarlo dal graph successivamente
      } else {
        var nodes = this.getShapeXml(shape, groupProp, stroke);
        connectionsNode.appendChild(nodes.connNode);
        fgNode.appendChild(nodes.fgNodes);
      }
    }

  }
  root.appendChild(connectionsNode);
  root.appendChild(fgNode);
  var v1;
  this.graph.getModel().beginUpdate();
  try {
    //rappresento lo stencil come base64 per aggiungerlo allo style del mxCell prodotto
    var xmlBase64 = this.graph.compress(mxUtils.getXml(root));
    v1 = this.graph.insertVertex(this.graph.getDefaultParent(), null, null, groupProp.x, groupProp.y, groupProp.w, groupProp.h, 'shape=stencil('+xmlBase64+');');
    //Rimuovo gli elementi che ora fanno parte del simbolo
    this.graph.removeCells(cellGroup);
    vertex.push(v1);
    //Se tra gli elementi è presente del testo, il risultato sarà un gruppo
    if(vertex.length>1) {
      this.graph.setSelectionCell(this.graph.groupCells(null, 0, vertex.reverse()));
    }

  } finally {
    this.graph.getModel().endUpdate();
  }
  return v1;
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
  var i;
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
* Questa funzione produce l'xml di un simbolo, con eventuali punti di attacco legati ad esso
* @param shape simbolo da tradurre in xml
* @param groupProp proprietà geometriche del gruppo di elementi originale
* @param stroke true per aggiungere lo sfondo alle linee, false altrimenti
* @return oggetto contenente gli elementi del foreground e gli elementi di connections
*/
ShapeCreator.prototype.getShapeXml = function(shape, groupProp, stroke) {
  var shapeType = shape.getShapeType();
  //Creo dei frammenti in cui inserire gli elementi XML rappresentante il simbolo
  var fgNode = this.xmlDoc.createDocumentFragment();
  var constraintNodes = this.xmlDoc.createDocumentFragment();
  //Se il simbolo è un gruppo, rappresento l'area di attacco.
  if(shapeType == shape.GROUP_SHAPE_TYPE && shape.isConstraint()) {
    var children = shape.children;
    var attr = this.getPathXml(children, groupProp, stroke, shape);
    fgNode.appendChild(attr);
  } else {
    if(shapeType == shape.LINE_SHAPE_TYPE){
      //Aggiungo un nodo path
      fgNode.appendChild(this.createLineNode(shape, groupProp));
      if(shape.isOutlineConstraint()) {
        constraintNodes.appendChild(this.createLineConstraintNode(shape, shape, groupProp));
      }
    } else if(shapeType == shape.STENCIL_SHAPE_TYPE) {

      fgNode.appendChild(this.createSubStencilNode(shape, groupProp));
      if(shape.isOutlineConstraint()) {
        constraintNodes.appendChild(this.createStencilOutlineConstraintNode(shape, groupProp));
      }
    } else if(shapeType == shape.CURVE_SHAPE_TYPE) {
      fgNode.appendChild(this.createCurveNode(shape, groupProp));
      if(shape.isOutlineConstraint()) {
        constraintNodes.appendChild(this.createCurveConstraintNode(shape, shape, groupProp));
      }
    } else if(shapeType == shape.IMAGE_SHAPE_TYPE) {
      fgNode.appendChild(this.createImageNode(shape, groupProp));
    }

    if(this.graph.getCellStyle(shape)[mxConstants.STYLE_DASHED]) {
      var dashedNode = this.xmlDoc.createElement('dashed');
      dashedNode.setAttribute('dashed', '1');
      fgNode.appendChild(dashedNode);
      var dashedPattern = this.graph.getCellStyle(shape)['dashPattern'];
      if(dashedPattern!=null) {
        var dashPatternNode = this.xmlDoc.createElement('dashpattern');
        dashPatternNode.setAttribute('pattern', dashedPattern);
        fgNode.appendChild(dashPatternNode);
      }
    } else {
      var dashedNode = this.xmlDoc.createElement('dashed');
      dashedNode.setAttribute('dashed', '0');
      fgNode.appendChild(dashedNode);
    }
    //Per lo spessore della linea
    var strokeWidth = this.graph.getCellStyle(shape)[mxConstants.STYLE_STROKEWIDTH];
    if(strokeWidth!=null) {
      var strokeWidthNode = this.xmlDoc.createElement('strokewidth');
      strokeWidthNode.setAttribute('width', strokeWidth);
      fgNode.appendChild(strokeWidthNode);
    } else {
      var strokeWidthNode = this.xmlDoc.createElement('strokewidth');
      strokeWidthNode.setAttribute('width', '1');
      fgNode.appendChild(strokeWidthNode);
    }
    //Per il colore di contorno
    var strokeColorNode = this.xmlDoc.createElement('strokecolor');
    strokeColorNode.setAttribute('color',this.graph.getCellStyle(shape)[mxConstants.STYLE_STROKECOLOR]);
    fgNode.appendChild(strokeColorNode);

    //Per il colore di riempimento
    var fillColor=this.graph.getCellStyle(shape)[mxConstants.STYLE_FILLCOLOR];

    if(fillColor!=null && stroke==false) {
      var fillColorNode = this.xmlDoc.createElement('fillcolor');
      fillColorNode.setAttribute('color',fillColor);
      fgNode.appendChild(fillColorNode);
      fgNode.appendChild(this.xmlDoc.createElement('fillstroke'));
    } else if(stroke==false){
      fgNode.appendChild(this.xmlDoc.createElement('stroke'));
    } else if(stroke) {
      fgNode.appendChild(this.xmlDoc.createElement('fillstroke'));
    }


  }
  //Aggiungo eventuali punti di attacco attached
  if(shape.getChildCount()>0 && shapeType!=shape.GROUP_SHAPE_TYPE) {
    var attachedPoints = shape.children;
    var j;
    for(j=0; j<attachedPoints.length; j++) {
      if(attachedPoints[j].isConstraint()) {
        var constraintNode;
        if(attachedPoints[j].style.includes('ellipse')) {
          constraintNode = this.createPointConstraintNode(shape, attachedPoints[j], groupProp);
        } else if(attachedPoints[j].edge) {
          if(attachedPoints[j].getShapeType()==shape.LINE_SHAPE_TYPE) {
            constraintNode = this.createLineConstraintNode(shape, attachedPoints[j], groupProp);
          } else if(attachedPoints[j].getShapeType() == shape.CURVE_SHAPE_TYPE) {
            constraintNode = this.createCurveConstraintNode(shape, attachedPoints[j], groupProp);
          }
        } else if(attachedPoints[j].getShapeType() == shape.STENCIL_SHAPE_TYPE) {
          if(attachedPoints[j].isAreaConstraint()) {
            var stencil = this.graph.getCellStyle(attachedPoints[j])[mxConstants.STYLE_SHAPE];

            var ctx = this.createCanvas(attachedPoints[j]);
            var relX;
            var relY;
            if(shape.edge) {
              relX = attachedPoints[j].getGeometry().x - groupProp.x;
              relY = attachedPoints[j].getGeometry().y - groupProp.y;
            } else {
              relX = attachedPoints[j].getGeometry().x + shape.getGeometry().x - groupProp.x;
              relY = attachedPoints[j].getGeometry().y + shape.getGeometry().y - groupProp.y;
            }
            //Per ogni punto controllo se tale punto è nel path
            var constraintNode = this.xmlDoc.createDocumentFragment();
            var areaWidth = attachedPoints[j].getGeometry().width;
            var areaHeight = attachedPoints[j].getGeometry().height;
            //Informazioni sull'area per l'unmerge
            var areaAttackNode = this.xmlDoc.createElement('areaattack');
            areaAttackNode.setAttribute('stencil', stencil);
            areaAttackNode.setAttribute('x', 'P'+relX);
            areaAttackNode.setAttribute('y', 'P'+relY);
            areaAttackNode.setAttribute('w', areaWidth);
            areaAttackNode.setAttribute('h', areaHeight);
            areaAttackNode.setAttribute('area', 1);
            constraintNode.appendChild(areaAttackNode);
            var row;
            var col;
            for(row=0;row<=areaWidth;row=row+5) {
              for(col=0;col<=areaHeight;col=col+5) {
                if(ctx.isPointInPath(row,col,'evenodd') || ctx.isPointInStroke(row,col)) {
                  var cn = this.xmlDoc.createElement('constraint');
                  /*var xc, yc;
                  if(shape.edge) {
                    xc = row;
                    yc = col;
                  } else {
                    xc = (attachedPoints[j].getGeometry().x + row);
                    yc = (attachedPoints[j].getGeometry().y + col);
                  }*/
                  cn.setAttribute('x', (relX+row)/groupProp.w);
                  cn.setAttribute('y', (relY+col)/groupProp.h);
                  cn.setAttribute('name','A'+attachedPoints[j].id+'_'+attachedPoints[j].getAttribute('label',''));
                  cn.setAttribute('perimeter',0);
                  constraintNode.appendChild(cn);
                }
              }
            }

          } else if(attachedPoints[j].isOutlineConstraint()) {
            attachedPoints[j].getGeometry().x += shape.getGeometry().x;
            attachedPoints[j].getGeometry().y += shape.getGeometry().y;
            constraintNode = this.createStencilOutlineConstraintNode(attachedPoints[j], groupProp);
          }
        }
        constraintNodes.appendChild(constraintNode);
      }
    }
  }
  return {connNode: constraintNodes, fgNodes: fgNode};
}

/**
 *  Questa funzione, dato uno shape (oggetto mxCell) produce un elemento canvas
 *  @return il canvas context che definisce il disegno
 */
ShapeCreator.prototype.createCanvas = function(shape) {
  var geo = shape.getGeometry();
  //Creo un oggetto canvas, con cui disegnerò l'oggetto descritto nel nodo path
  var canvasElement = document.createElement('canvas');
  var c = canvasElement.getContext('2d');
  //Prelevo il base64 che descrive lo stencil e lo traduco in xml
  var base64 = this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE];
  if(!base64.includes('stencil')) {
    //è un rettangolo
    if(base64.includes('rectangle')) {
      c.rect(0, 0, geo.width, geo.height);
    } //è un ellisse
    else if(base64.includes('circle')) {
      c.ellipse(geo.width/2,geo.height/2,geo.width/2,geo.height/2,0,2*Math.PI, false);
      c.stroke();
    }
  } else {
    var desc = this.graph.decompress(base64.substring(8, base64.length-1));
    //Traduco l'xml (stringa) in oggetto xml
    var shapeXml = mxUtils.parseXml(desc);
    //Prelevo il nodo path
    var foreground = shapeXml.getElementsByTagName('foreground')[0];
    var paths = foreground.getElementsByTagName('path');
    //Disegno l'oggetto in canvas
    c.beginPath();
    var path_index;
    var obj_index;
    for(path_index=0; path_index<paths.length; path_index++) {
      var obj = paths[path_index].childNodes;
      for(obj_index=0; obj_index<obj.length; obj_index++) {
        if(obj[obj_index].tagName == 'move') {
          var x = obj[obj_index].getAttribute('x');
          var y = obj[obj_index].getAttribute('y');
          c.moveTo(x,y);
        } else if(obj[obj_index].tagName == 'line') {
          var x = obj[obj_index].getAttribute('x');
          var y = obj[obj_index].getAttribute('y');
          c.lineTo(x,y);
        } else if(obj[obj_index].tagName == 'quad') {
          var x1 = obj[obj_index].getAttribute('x1');
          var y1 = obj[obj_index].getAttribute('y1');
          var x2 = obj[obj_index].getAttribute('x2');
          var y2 = obj[obj_index].getAttribute('y2');
          c.quadraticCurveTo(x1,y1,x2,y2);
        }
      }

    }
    c.closePath()
    c.stroke();
  }
  return c;
}

/**
* Questa funzione, data una lista di linee, produce un path unico in XML
*/
ShapeCreator.prototype.getPathXml = function(lines, groupProp, stroke, parent) {
  var pathNode = this.xmlDoc.createElement('path');
  var edges = [];
  //Creo una struttura dati contenente, per ogni elemento, la lista dei punti
  var l_index;
  for(l_index=0; l_index<lines.length; l_index++) {
    //lines[l_index].getGeometry().translate(parent.getGeometry().x, parent.getGeometry().y);
    var allPoints = lines[l_index].getAllPoints();
    var valueToAdd = {};
    valueToAdd.type = lines[l_index].getShapeType();
    valueToAdd.points = allPoints;
    edges.push(valueToAdd);
  }
  var nextEdge = 0;
  var reverse = false;
  var moveNode = this.xmlDoc.createElement('move');
  moveNode.setAttribute('x',edges[nextEdge].points[0].x-groupProp.x);
  moveNode.setAttribute('y',edges[nextEdge].points[0].y-groupProp.y);
  pathNode.appendChild(moveNode);
  while(edges[nextEdge]!=null) {
    var points = edges[nextEdge].points;
    var pi;
    var x;
    var y;
    //Se il punto iniziale del prossimo elemento coincide con il suo punto di terminazione
    //devo considerare i punti a partire da quest'ultimo
    if(reverse == true) {
      points = points.reverse();
    }
    if(edges[nextEdge].type == 'curve' && points.length>2) {
      if(points.length==3) { //Se la curva ha un solo punto di controllo, uso un nodo quad
        var quadNode = this.xmlDoc.createElement('quad');
        quadNode.setAttribute('x1',points[1].x-groupProp.x);
        quadNode.setAttribute('y1',points[1].y-groupProp.y);
        quadNode.setAttribute('x2',points[2].x-groupProp.x);
        quadNode.setAttribute('y2',points[2].y-groupProp.y);
        pathNode.appendChild(quadNode);
        x = points[2].x;
        y = points[2].y;
      } else {
        var pi;
        for(pi=1; pi<points.length-2; pi++) {
          var quadNode = this.xmlDoc.createElement('quad');
          var xc = (points[pi].x-groupProp.x + points[pi + 1].x-groupProp.x) / 2;
          var yc = (points[pi].y-groupProp.y + points[pi + 1].y-groupProp.y) / 2;
          quadNode.setAttribute('x1',points[pi].x-groupProp.x);
          quadNode.setAttribute('y1',points[pi].y-groupProp.y);
          quadNode.setAttribute('x2',xc);
          quadNode.setAttribute('y2',yc);
          pathNode.appendChild(quadNode);
        }
        var quadNode = this.xmlDoc.createElement('quad');
        quadNode.setAttribute('x1',points[pi].x-groupProp.x);
        quadNode.setAttribute('y1',points[pi].y-groupProp.y);
        quadNode.setAttribute('x2',points[pi+1].x-groupProp.x);
        quadNode.setAttribute('y2',points[pi+1].y-groupProp.y);
        pathNode.appendChild(quadNode);
        x = points[pi+1].x;
        y = points[pi+1].y;
      }
    } else if(edges[nextEdge].type == 'line') {
      var pi;
      for(pi=1; pi<points.length; pi++) {
        var lineNode = this.xmlDoc.createElement('line');
        lineNode.setAttribute('x',points[pi].x-groupProp.x);
        lineNode.setAttribute('y',points[pi].y-groupProp.y);
        pathNode.appendChild(lineNode);
      }
      x = points[pi-1].x;
      y = points[pi-1].y;
    }
    //Elimino l'elemento disegnato dalla struttura dati
    delete edges[nextEdge];
    //Cerco il prossimo elemento
    var value = this.searchPoint(edges, x, y);
    nextEdge = value.prox;
    reverse = value.rev;
  }
  return pathNode;
}


/**
* Questa funzione trova il simbolo che ha un'estremità che coincide con i punti x e y
* @param listE lista di elementi sulla quale effettuare la ricerca
* @param x coordinata x del punto da cercare
* @param y coordianta y del punto da cercare
* @return oggetto contente l'elemento cercato e il reverse, che indica se il punto
* che coincide con (x,y) è un punto sorgente o di terminazione.
*/
ShapeCreator.prototype.searchPoint = function(listE, x, y) {
  var ee;
  for(ee=0; ee<listE.length; ee++) {
    if(listE[ee]!=null) {
      var listP = listE[ee].points;
      if(listP[0].x == x && listP[0].y == y) {
        return {prox: ee, rev: false};
      }
      if(listP[listP.length-1].x == x && listP[listP.length-1].y == y) {
        return {prox: ee, rev: true};
      }
    }
  }
  return -1;
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
    var i;
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
    var i;
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
  var shapeNodes = this.xmlDoc.createDocumentFragment();
  var includeShapeNode;
  var shapeState = this.graph.view.getState(shape);
  var shapeName = this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE];
  if(shapeName=='mxgraph.general.rectangle') {
    includeShapeNode = this.xmlDoc.createElement('rect');
    includeShapeNode.setAttribute('x', shapeState.origin.x-groupProp.x);
    includeShapeNode.setAttribute('y', shapeState.origin.y-groupProp.y);

    includeShapeNode.setAttribute('w', shapeState.cellBounds.width);
    includeShapeNode.setAttribute('h', shapeState.cellBounds.height);
    shapeNodes.appendChild(includeShapeNode);
  } else if(shapeName=='mxgraph.general.circle') {
    includeShapeNode = this.xmlDoc.createElement('ellipse');
    includeShapeNode.setAttribute('x', shapeState.origin.x-groupProp.x);
    includeShapeNode.setAttribute('y', shapeState.origin.y-groupProp.y);

    includeShapeNode.setAttribute('w', shapeState.cellBounds.width);
    includeShapeNode.setAttribute('h', shapeState.cellBounds.height);
    shapeNodes.appendChild(includeShapeNode);
  } else if(shapeName.includes('stencil(')) {
    var base64 = shapeName.substring(8, shapeName.length-1);
    var desc = this.graph.decompress(base64);
    var foregroundChildrenXml = mxUtils.parseXml(desc).documentElement.getElementsByTagName('foreground')[0].childNodes;
    var i;
    for(i=0; i<foregroundChildrenXml.length; i++) {
      if(foregroundChildrenXml[i].tagName == 'path') {
        var pathChildrenXml = this.getAllElementChildNodes(foregroundChildrenXml[i]);
        var j;
        for(j=0; j<pathChildrenXml.length; j++) {
          if(pathChildrenXml[j].getAttribute('x',null)!=null) {
            pathChildrenXml[j].setAttribute('x',Number(pathChildrenXml[j].getAttribute('x','0'))+(shapeState.origin.x - groupProp.x));
            pathChildrenXml[j].setAttribute('y',Number(pathChildrenXml[j].getAttribute('y','0'))+(shapeState.origin.y - groupProp.y));
          }
        }
        shapeNodes.appendChild(foregroundChildrenXml[i]);
      }
    }
  } else {
    includeShapeNode = this.xmlDoc.createElement('include-shape');
    includeShapeNode.setAttribute('name', shapeName);
    includeShapeNode.setAttribute('x', shapeState.origin.x-groupProp.x);
    includeShapeNode.setAttribute('y', shapeState.origin.y-groupProp.y);

    includeShapeNode.setAttribute('w', shapeState.cellBounds.width);
    includeShapeNode.setAttribute('h', shapeState.cellBounds.height);
    shapeNodes.appendChild(includeShapeNode);
  }


  return shapeNodes;
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

ShapeCreator.prototype.createImageNode = function(shape, groupProp) {
  var state = this.graph.getView().getState(shape);
  var url = state.style[mxConstants.STYLE_IMAGE];
  var imageNode = this.xmlDoc.createElement('image');
  imageNode.setAttribute('src', url);
  imageNode.setAttribute('x', state.origin.x-groupProp.x);
  imageNode.setAttribute('y', state.origin.y-groupProp.y);
  imageNode.setAttribute('w', state.cellBounds.width);
  imageNode.setAttribute('h', state.cellBounds.height);
  return imageNode;
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
  constraintNode.setAttribute('name','P'+point.id+'_'+point.getAttribute('label',''));
  constraintNode.setAttribute('perimeter',0);

  return constraintNode;
}

ShapeCreator.prototype.createLineConstraintNode = function(shape, line, groupProp) {
  var points = line.getAllPoints();
  var lineAttackNode = this.xmlDoc.createDocumentFragment();
  var constraintNodes = this.xmlDoc.createDocumentFragment();

  var linePoints = [];
  var i;
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

    linePoints.push({x: x1, y: y1});
    linePoints.push({x: x2, y: y2});
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
      var y;
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
        constraintNode.setAttribute('name','L'+line.id+'_'+line.getAttribute('label',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
    } else {
      if(x1>x2) {
        var t=x2;
        x2 = x1;
        x1 = t;
      }
      var x;
      for(x=x1; x<x2; x=x+2) {
        var y = m*x+c;
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', x/groupProp.w);
        constraintNode.setAttribute('y', y/groupProp.h);
        constraintNode.setAttribute('name','L'+line.id+'_'+line.getAttribute('label',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
    }
  }
  var lineSpecNode = this.xmlDoc.createElement('lineattack');
  lineSpecNode.setAttribute('x', this.graph.compress(JSON.stringify(linePoints)));
  lineAttackNode.appendChild(lineSpecNode);
  lineAttackNode.appendChild(constraintNodes);
  return lineAttackNode;
}

ShapeCreator.prototype.createCurveConstraintNode = function(shape, curve, groupProp) {
  var points = curve.getAllPoints();
  var curveLineNode = this.xmlDoc.createDocumentFragment();
  var constraintNodes = this.xmlDoc.createDocumentFragment();

  var relativeP = [];
  var i;
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
    var i;
    for(i=0; i<1; i=i+0.02) {
      var p = this.getPointOnQuadCurve(i, relativeP[0], relativeP[1], relativeP[2]);
      var constraintNode = this.xmlDoc.createElement('constraint');
      constraintNode.setAttribute('x', p.x/groupProp.w);
      constraintNode.setAttribute('y', p.y/groupProp.h);
      constraintNode.setAttribute('name','C'+curve.id+'_'+curve.getAttribute('label',''));
      constraintNode.setAttribute('perimeter',0);
      constraintNodes.appendChild(constraintNode);
    }
  } else {
    var j;
    var prexc = relativeP[0].x;
    var preyc = relativeP[0].y;
    var j;
    var i;
    for(j=1; j<points.length-2; j++) {
      for(i=0; i<1; i=i+0.02) {
        var xc = (relativeP[j].x+relativeP[j+1].x)/2;
        var yc = (relativeP[j].y+relativeP[j+1].y)/2;
        var p = this.getPointOnQuadCurve(i, {x: prexc, y: preyc}, relativeP[j], {x:xc, y:yc});
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', p.x/groupProp.w);
        constraintNode.setAttribute('y', p.y/groupProp.h);
        constraintNode.setAttribute('name','C'+curve.id+'_'+curve.getAttribute('label',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
      prexc = xc;
      preyc = yc;
    }
    var i;
    for(i=0; i<1; i=i+0.02) {
      var xc = (relativeP[j-1].x+relativeP[j].x)/2;
      var yc = (relativeP[j-1].y+relativeP[j].y)/2;
      var p = this.getPointOnQuadCurve(i, {x:xc, y:yc}, relativeP[j], relativeP[j+1]);
      var constraintNode = this.xmlDoc.createElement('constraint');
      constraintNode.setAttribute('x', p.x/groupProp.w);
      constraintNode.setAttribute('y', p.y/groupProp.h);
      constraintNode.setAttribute('name','C'+curve.id+'_'+curve.getAttribute('label',''));
      constraintNode.setAttribute('perimeter',0);
      constraintNodes.appendChild(constraintNode);
    }

  }
  var curveSpecNode = this.xmlDoc.createElement('curveattack');
  curveSpecNode.setAttribute('x', this.graph.compress(JSON.stringify(relativeP)));
  curveLineNode.appendChild(curveSpecNode);
  curveLineNode.appendChild(constraintNodes);
  return curveLineNode;
}

/**
 *  Questa funzione restituisce un frammento XML contenente i punti di attacco sul contorno di uno stencil
 *  @param shape stencil di cui si vogliono rappresentare in XML i punto di attacco del contorno
 *  @param groupProp oggetto contenente le informazioni geometriche del gruppo di simboli da trasformare in XML
 */
ShapeCreator.prototype.createStencilOutlineConstraintNode = function(shape, groupProp) {
    var geo = shape.getGeometry();
    var constraintNodes = this.xmlDoc.createDocumentFragment();
    var x = geo.x-groupProp.x;
    var y = geo.y-groupProp.y;

    var areaAttackNode = this.xmlDoc.createElement('areaattack');
    areaAttackNode.setAttribute('stencil', this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE]);
    areaAttackNode.setAttribute('x', 'P'+x);
    areaAttackNode.setAttribute('y', 'P'+y);
    areaAttackNode.setAttribute('w', geo.width);
    areaAttackNode.setAttribute('h', geo.height);
    areaAttackNode.setAttribute('area', '0');
    constraintNodes.appendChild(areaAttackNode);
    if(this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE]=='mxgraph.general.rectangle') {
      var i;
      for(i=x; i<x+geo.width; i=i+2) {
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', i/groupProp.w);
        constraintNode.setAttribute('y', y/groupProp.h);
        constraintNode.setAttribute('name','A'+shape.id+'_'+shape.getAttribute('label',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);

        constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', i/groupProp.w);
        constraintNode.setAttribute('y', (y+geo.height)/groupProp.h);
        constraintNode.setAttribute('name','A'+shape.id+'_'+shape.getAttribute('label',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
      var i;
      for(i=y; i<y+geo.height; i=i+2) {
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', x/groupProp.w);
        constraintNode.setAttribute('y', i/groupProp.h);
        constraintNode.setAttribute('name','A'+shape.id+'_'+shape.getAttribute('label',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);

        constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', (x+geo.width)/groupProp.w);
        constraintNode.setAttribute('y', i/groupProp.h);
        constraintNode.setAttribute('name','A'+shape.id+'_'+shape.getAttribute('label',''));
        constraintNode.setAttribute('perimeter',0);
        constraintNodes.appendChild(constraintNode);
      }
    } else if(this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE]=='mxgraph.general.circle') {
      var i;
      for(i=0; i<4*Math.PI; i=i+0.05) {
        var constraintNode = this.xmlDoc.createElement('constraint');
        constraintNode.setAttribute('x', (x+(((geo.width/2)*Math.cos(i)))+geo.width/2)/groupProp.w);
        constraintNode.setAttribute('y', (y+(((geo.height/2)*Math.sin(i)))+geo.height/2)/groupProp.h);
        constraintNode.setAttribute('name','A'+shape.id+'_'+shape.getAttribute('label',''));
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



ShapeCreator.prototype.unmergeShape = function(cellToTransform) {
  var geoCell = cellToTransform.getGeometry();
  var stencil = this.graph.getCellStyle(cellToTransform)[mxConstants.STYLE_SHAPE];
  var shapeXml;
  //Se lo stencil è definito in base64, effettuo il decode per ottenere l'xml
  if(stencil.includes('stencil(')) {
    var base64 = stencil.substring(8, stencil.length-1);
    var desc = this.graph.decompress(base64);
    shapeXml = mxUtils.parseXml(desc);
  } else {
    /*
    Se lo stencil è definito da un nome, allora è presente nello mxStencilRegistry.
    Da lì posso ottenere l'xml.
    */
    shapeXml = mxStencilRegistry.getStencil(stencil).desc;
  }
  var cellsToAdd = []; //Lista dei simboli componenti da aggiungere all'editor
  var lastCells = []; //Simboli inserite nell'ultima iterazione (necessario per modificare lo stile)

  var connectionsNode = shapeXml.getElementsByTagName('connections')[0];
  var connectionChildNodes = this.getAllElementChildNodes(connectionsNode);

  var i;
  for(i=0; i<connectionChildNodes.length; i++) {
    var node = connectionChildNodes[i];
    if(node.tagName == 'constraint' && node.getAttribute('name')[0] == 'P') {
      var x = node.getAttribute('x')*geoCell.width+geoCell.x-2.5;
      var y = node.getAttribute('y')*geoCell.height+geoCell.y-2.5;
      var doc = mxUtils.createXmlDocument();
      var nodeCell = doc.createElement('AttackSymbol');
		  nodeCell.setAttribute('label', '');
			nodeCell.setAttribute('isConstraint', 1);
      var cell = new mxCell(nodeCell, new mxGeometry(x, y, 5, 5), 'ellipse;rotatable=0;resizable=0;fillColor=#d5e8d4;strokeColor=#80FF00;strokeWidth=0;');
      cell.vertex = true;
      cell.connectable = false;
      cell.visible = false;
      cellsToAdd.push(cell);
    } else if(node.tagName == 'lineattack' || node.tagName == 'curveattack') {
      var points = JSON.parse(this.graph.decompress(node.getAttribute('x')));

      var lineGeometry = new mxGeometry();
      lineGeometry.sourcePoint = new mxPoint(geoCell.x+points[0].x, geoCell.y+points[0].y);

      lineGeometry.points = [];
      var j;
      for(j=1; j<points.length-1; j++) {
        lineGeometry.points.push(new mxPoint(geoCell.x+points[j].x, geoCell.y+points[j].y));
      }
      lineGeometry.targetPoint = new mxPoint(geoCell.x+points[j].x, geoCell.y+points[j].y);
      var doc = mxUtils.createXmlDocument();
      var nodeCell = doc.createElement('AttackSymbol');
		  nodeCell.setAttribute('label', '');
			nodeCell.setAttribute('isConstraint', 1);
      var style;
      if(node.tagName == 'lineattack') {
        style = 'endArrow=none;html=1;rounded=0;rotatable=0;resizable=0;fillColor=#d5e8d4;strokeColor=#80FF00;strokeWidth=2;opacity=70;';
      } else {
        style = 'curved=1;endArrow=none;html=1;rotatable=0;resizable=0;fillColor=#CDEB8B;strokeColor=#80FF00;strokeWidth=2;opacity=70;';
      }
      var cell = new mxCell(nodeCell, lineGeometry, style);
      cell.edge = true;
      cell.connectable = false;
      cell.visible = false;
      cellsToAdd.push(cell);
    } else if(node.tagName == 'areaattack') {
      var stencil = node.getAttribute('stencil');
      var sourcePoint_x = geoCell.x+Number(node.getAttribute('x').substring(1));
      var sourcePoint_y = geoCell.y+Number(node.getAttribute('y').substring(1));
      var dimension_w = Number(node.getAttribute('w'));
      var dimension_h = Number(node.getAttribute('h'));
      var areaGeometry = new mxGeometry(sourcePoint_x, sourcePoint_y, dimension_w, dimension_h);
      var doc = mxUtils.createXmlDocument();
      var nodeCell = doc.createElement('AttackSymbol');
		  nodeCell.setAttribute('label', '');
			nodeCell.setAttribute('isConstraint', 1);
      var style = '';
      if(Number(node.getAttribute('area'))==1) {
        nodeCell.setAttribute('areaConstraint', 1);
        style = 'shape='+stencil+';fillColor=#CDEB8B;strokeColor=#80FF00;strokeWidth=2;opacity=70;';
      } else {
        nodeCell.setAttribute('areaConstraint', 0);
        nodeCell.setAttribute('outlineConstraint',1);
        style = 'shape='+stencil+';fillColor=none;strokeColor=#80FF00;strokeWidth=2;opacity=70;';
      }
      var cell = new mxCell(nodeCell, areaGeometry, style);
      cell.vertex = true;
      cell.connectable = false;
      cell.visible = false;
      cellsToAdd.push(cell);
    }
  }


  var foregroundNode = shapeXml.getElementsByTagName('foreground')[0];
  var foregroundChildNodes = this.getAllElementChildNodes(foregroundNode);


  var i;
  for(i=0; i<foregroundChildNodes.length; i++) {
    var node = foregroundChildNodes[i];

    var groupProp;
    if(node.tagName == 'image') {
      lastCells = [];
      var cell = new mxCell();
      cell.setGeometry(new mxGeometry(Number(node.getAttribute('x'))+geoCell.x, Number(node.getAttribute('y'))+geoCell.y, Number(node.getAttribute('w')), Number(node.getAttribute('h'))));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_SHAPE, 'image');
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_IMAGE, node.getAttribute('src').replace(';base64',''));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_STROKEWIDTH, 1);
      cell.vertex = true;
      cell.connectable = false;
      cellsToAdd.push(cell);
      lastCells.push(cell);
    } else if(node.tagName == 'include-shape') {
      lastCells = [];
      var cell = new mxCell();
      cell.setGeometry(new mxGeometry(Number(node.getAttribute('x'))+geoCell.x, Number(node.getAttribute('y'))+geoCell.y, Number(node.getAttribute('w')), Number(node.getAttribute('h'))));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_SHAPE, node.getAttribute('name'));
      cell.vertex = true;
      cellsToAdd.push(cell);
      lastCells.push(cell);
    } else if(node.tagName == 'rect') {
      lastCells = [];
      var cell = new mxCell();
      cell.setGeometry(new mxGeometry(Number(node.getAttribute('x'))+geoCell.x, Number(node.getAttribute('y'))+geoCell.y, Number(node.getAttribute('w')), Number(node.getAttribute('h'))));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_SHAPE, 'mxgraph.general.rectangle');
      cell.vertex = true;
      cell.connectable = false;
      cellsToAdd.push(cell);
      lastCells.push(cell);
    } else if(node.tagName == 'ellipse') {
      lastCells = [];
      var cell = new mxCell();
      cell.setGeometry(new mxGeometry(Number(node.getAttribute('x'))+geoCell.x, Number(node.getAttribute('y'))+geoCell.y, Number(node.getAttribute('w')), Number(node.getAttribute('h'))));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_SHAPE, 'mxgraph.general.circle');
      cell.vertex = true;
      cell.connectable = false;
      cellsToAdd.push(cell);
      lastCells.push(cell);
    } else if(node.tagName == 'path') {
      lastCells = [];
      var pathNodes = this.getAllElementChildNodes(node);

      var sourcePoint;
      var controlPoint = [];
      var terminalPoint;

      var currentPoint;
      var prevPoint;

      var isLine = false;
      var isCurve = false;

      var j;
      for(j=0; j<pathNodes.length; j++) {

        if(pathNodes[j].tagName == 'move') {
          currentPoint = new mxPoint(Number(pathNodes[j].getAttribute('x'))+geoCell.x, Number(pathNodes[j].getAttribute('y'))+geoCell.y);
        } else if(pathNodes[j].tagName == 'line') {
          currentPoint = new mxPoint(Number(pathNodes[j].getAttribute('x'))+geoCell.x, Number(pathNodes[j].getAttribute('y'))+geoCell.y);
          /*Se stavo già disegnando una linea, allora il punto precedente è un contol point
            altrimenti il punto precedente è il punto sorgente. (Nota: il nodo xml line indica tra gli attributi
            SOLO il punto finale)
          */
          if(!isLine) {
            isLine = true;
            sourcePoint = prevPoint;
            controlPoint = [];
          }
          /*Se il nodo successivo descrive una linea allora il punto corrente è un control point
            altrimenti è il punto terminale.
          */
         if(j<pathNodes.length-1 && pathNodes[j+1].tagName == 'line') {
            controlPoint.push(currentPoint);
          } else {
            terminalPoint = currentPoint;
            isLine = false;
            var cell = new mxCell();
            var newGeo = new mxGeometry();
            newGeo.sourcePoint = sourcePoint;
            newGeo.points = controlPoint;
            newGeo.targetPoint = terminalPoint;
            newGeo.width = 1;
            newGeo.height = 1;
            newGeo.relative = true;
            cell.setGeometry(newGeo);
            cell.style = 'endArrow=none;curved=0;rounded=0;';
            cell.edge = true;
            cell.vertex = true;
            cellsToAdd.push(cell);
            lastCells.push(cell);
          }
        } else if(pathNodes[j].tagName == 'quad') {
          var point1 = new mxPoint(Number(pathNodes[j].getAttribute('x1'))+geoCell.x, Number(pathNodes[j].getAttribute('y1'))+geoCell.y);
          currentPoint = new mxPoint(Number(pathNodes[j].getAttribute('x2'))+geoCell.x, Number(pathNodes[j].getAttribute('y2'))+geoCell.y);
          /*
          * Se isCurve è false allora questo è il primo tag riferito alla curva.
          * Il punto sorgente è il precedente, mentre le due coordinate definite dal tag corrente
          * individuano due punti di controllo
          */
          if(!isCurve) {
            isCurve = true;
            controlPoint = [];
            sourcePoint = prevPoint;
            controlPoint.push(point1);
          }
          /*
            Se il prossimo tag descrive una curva, allora il secondo punto del tag corrente (ossia currentPoint)
            è un punto di controllo. Altrimenti il currentPoint è il punto terminale.
          */
          if(j<pathNodes.length-1 && pathNodes[j+1].tagName == 'quad') {
            var xc = currentPoint.x * 2 - point1.x;
            var yc = currentPoint.y * 2 - point1.y;
            controlPoint.push(new mxPoint(xc, yc));
          } else {
            terminalPoint = new mxPoint(currentPoint.x, currentPoint.y);
            isCurve = false;
            var cell = new mxCell();
            var newGeo = new mxGeometry();
            newGeo.sourcePoint = sourcePoint;
            newGeo.points = controlPoint;
            newGeo.targetPoint = terminalPoint;
            newGeo.width = 1;
            newGeo.height = 1;
            newGeo.relative = true;
            cell.setGeometry(newGeo);
            cell.style = 'endArrow=none;curved=1;';
            cell.edge = true;
            cell.vertex = true;
            cellsToAdd.push(cell);
            lastCells.push(cell);
          }
        } else if(pathNodes[j].tagName == 'close') {
          var cell = new mxCell();
          var newGeo = new mxGeometry();
          newGeo.sourcePoint = currentPoint;
          newGeo.targetPoint = new mxPoint(Number(pathNodes[0].getAttribute('x'))+geoCell.x, Number(pathNodes[0].getAttribute('y'))+geoCell.y);
          newGeo.width = 1;
          newGeo.height = 1;
          newGeo.relative = true;
          cell.setGeometry(newGeo);
          cell.style = 'endArrow=none;curved=0;rounded=0;';
          cell.edge = true;
          cell.vertex = true;
          cellsToAdd.push(cell);
          lastCells.push(cell);
        }
        prevPoint = currentPoint;
      }

    } else if(node.tagName == 'dashed') {
      if(node.getAttribute('dashed')=='1') {
        var dashedPattern;
        if(node.nextSibling.tagName == 'dashpattern') {
          this.addAttrStyleCells(lastCells, 'dashPattern', node.nextSibling.getAttribute('pattern'));
        }
        this.addAttrStyleCells(lastCells, mxConstants.STYLE_DASHED, 1);
      }
    } else if(node.tagName == 'strokewidth') {
      this.addAttrStyleCells(lastCells, mxConstants.STYLE_STROKEWIDTH, node.getAttribute('width'));
    } else if(node.tagName == 'strokecolor') {
      this.addAttrStyleCells(lastCells, mxConstants.STYLE_STROKECOLOR, node.getAttribute('color'));
    } else if(node.tagName == 'fillcolor') {
      this.addAttrStyleCells(lastCells, mxConstants.STYLE_FILLCOLOR, node.getAttribute('color'));
    } else {
      continue;
    }
  }
  this.graph.getModel().beginUpdate();
  this.graph.addCells(cellsToAdd);
  this.graph.removeCells([cellToTransform]);
  this.graph.getModel().endUpdate();
  this.graph.refresh();
  return cellsToAdd;
}

/*
 *  Questo funzione restituisc tutti i nodi XML figli che non sono testo
 */
ShapeCreator.prototype.getAllElementChildNodes = function(parent) {
  var elementChildren = [];
  if(parent!=null) {
    var cn = parent.childNodes;
    var i=0;
    for(i=0; i<cn.length; i++) {
      if(cn[i].nodeType!=Node.TEXT_NODE) {
        elementChildren.push(cn[i]);
      }
    }
  }
  return elementChildren;
}

/**
 *  Questa funzione aggiunge un valore di stile ad una lista di simboli.
 * @param cells lista di simboli di cui modificare lo stile
 * @param stylename nome dell'attributo dello stile da modificare
 * @param stylevalue nuovo valore da assegnare all'attributo
 */
ShapeCreator.prototype.addAttrStyleCells = function(cells, stylename, stylevalue) {
  var i;
  for(i=0; i<cells.length; i++) {
    cells[i].style = mxUtils.setStyle(cells[i].style, stylename, stylevalue);
  }
}
