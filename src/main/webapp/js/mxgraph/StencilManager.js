/**
 * Istanzianzione della classe StencilManager, che permette di creare uno
 * stencil definito da un documento XML, dato il graph di riferimento.
*/
function StencilManager(graph) {
  this.graph = graph;
}

/**
  Crea uno Stencil definito da un documento XML dato un array di cells e lo aggiunge al graph.
  @param cellGroup array di cells
  @param stroke true se aggiungere lo sfondo alle linee spezzate, false altrimenti
  @param isPath true per creare un path unico per le linee, false altrimenti
*/
StencilManager.prototype.mergeShapes = function(cellGroup, stroke, isPath, color) {
  var groupProp = this.getSizeAndPosition(cellGroup);

  //Creo il documento XML per lo shape
  this.xmlDoc = mxUtils.createXmlDocument();
  //Definisco il tag radice
  var root = this.xmlDoc.createElement('shape');
  root.setAttribute('h',groupProp.h);
  root.setAttribute('w',groupProp.w);
  root.setAttribute('aspect','variable');
  root.setAttribute('strokewidth','inherit');
  this.xmlDoc.appendChild(root);
  //Definisco i due tag figli
  //Nodo contenente i punti di attacco
  var connectionsNode = this.xmlDoc.createElement('connections');
  //Nodo contenente i tag che definiscono il simbolo
  var fgNode = this.xmlDoc.createElement('foreground');
  fgNode.appendChild(this.xmlDoc.createElement('fillstroke'));
  //Creo un array in cui inserire le celle da raggruppare e che costituiranno lo shape finale
  var vertex = new Array();
  if(isPath) { //Per creare un unico path di linee
    var path = this.getPathXml(cellGroup, groupProp, stroke);
    fgNode.appendChild(path);
    if(color!=null) {
      var fillColorNode = this.xmlDoc.createElement('fillcolor');
      fillColorNode.setAttribute('color', color);
      fgNode.appendChild(fillColorNode);
    }
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
  //Genero la codifica in base64 del documento XML che descrive il simbolo
  var xmlBase64 = this.graph.compress(mxUtils.getXml(root));

  return {base64: xmlBase64, shapeGeo: groupProp, text: vertex};
}

/**
  Questo metodo restuisce la dimensione di una selezione di uno o più elementi.
  @param group elementi selezionati
  @return oggetto contente le coordinate (x e y), e le dimensioni (w e h)
*/
StencilManager.prototype.getSizeAndPosition = function (group) {
  var cellBounds = this.graph.view.getState(group[0]).getCellBounds();

  var maxX = cellBounds.x+cellBounds.width;
  var maxY = cellBounds.y+cellBounds.height;
  var minX = cellBounds.x;
  var minY = cellBounds.y;

  //Calcolo le coordinate massime e minime
  var i;
  for(i=1; i<group.length; i++) {
    if(group[i].isVisible()) {
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
StencilManager.prototype.getShapeXml = function(shape, groupProp, stroke) {
  var shapeType = shape.getShapeType();
  //Creo dei frammenti in cui inserire gli elementi XML rappresentante il simbolo
  var fgNode = this.xmlDoc.createDocumentFragment();
  var constraintNodes = this.xmlDoc.createDocumentFragment();
  //Se il simbolo rappresenta un punto di attacco, aggiungo i tag per lo stile del simbolo
  if(!shape.isConstraint()) {
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
  }

  //Se il simbolo è un gruppo, rappresento l'area di attacco.
  if(shapeType == shape.GROUP_SHAPE_TYPE && shape.isConstraint()) {
    var children = shape.children;
    var attr = this.getPathXml(children, groupProp, stroke, shape);
    fgNode.appendChild(attr);
  } else {
    if(shapeType == shape.LINE_SHAPE_TYPE){
      if(shape.isConstraint()) {
        constraintNodes.appendChild(this.createLineConstraintNode(shape, groupProp));
      } else {
        //Aggiungo un nodo path
        fgNode.appendChild(this.createLineNode(shape, groupProp));
        if(shape.isOutlineConstraint()) {
          constraintNodes.appendChild(this.createLineConstraintNode(shape, groupProp));
        }
      }
    } else if(shapeType == shape.STENCIL_SHAPE_TYPE) {
      if(shape.isConstraint()) {
        if(shape.isAreaConstraint()) {
          constraintNodes.appendChild(this.createAreaConstraintNode(shape, groupProp));
        } else if(shape.isOutlineConstraint()){
          constraintNodes.appendChild(this.createStencilOutlineConstraintNode(shape, groupProp));
        }
      } else {
        fgNode.appendChild(this.createSubStencilNode(shape, groupProp));
        if(shape.isOutlineConstraint()) {
          constraintNodes.appendChild(this.createStencilOutlineConstraintNode(shape, groupProp));
        }
      }
    } else if(shapeType == shape.CURVE_SHAPE_TYPE) {
      if(shape.isConstraint()) {
        constraintNodes.appendChild(this.createCurveConstraintNode(shape, groupProp));
      } else {
        fgNode.appendChild(this.createCurveNode(shape, groupProp));
        if(shape.isOutlineConstraint()) {
          constraintNodes.appendChild(this.createCurveConstraintNode(shape, groupProp));
        }
      }
    } else if(shapeType == shape.IMAGE_SHAPE_TYPE) {
      fgNode.appendChild(this.createImageNode(shape, groupProp));
    } else if(shapeType == shape.POINT_SHAPE_TYPE) {
      constraintNodes.appendChild(this.createPointConstraintNode(shape, groupProp));
    }

    if(!shape.isConstraint()) {
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

  }
  return {connNode: constraintNodes, fgNodes: fgNode};
}

/**
 *  Questa funzione, dato uno shape (oggetto mxCell) produce un elemento canvas
 *  @return il canvas context che definisce il disegno
 */
StencilManager.prototype.createCanvas = function(shape) {
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
StencilManager.prototype.getPathXml = function(lines, groupProp, stroke, parent) {
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
  //Aggiungo il tag che rappresenta il punto di partenza
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
StencilManager.prototype.searchPoint = function(listE, x, y) {
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
StencilManager.prototype.createLineNode = function(shape, groupProp) {
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
StencilManager.prototype.createSubStencilNode = function(shape, groupProp) {
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
  } else if(shapeName.includes('arc')) {
    var desc = mxStencilRegistry.getStencil(shapeName).desc;
    var pathNode = desc.getElementsByTagName('path')[0];
    var moveNode = pathNode.childNodes[0];
    var arcNode = pathNode.childNodes[1];
    var x = (Number(moveNode.getAttribute('x'))+shapeState.origin.x)-groupProp.x;
    var y = (Number(moveNode.getAttribute('y'))+shapeState.origin.y)-groupProp.y;
    moveNode.setAttribute('x',x);
    moveNode.setAttribute('y',y);
    var x = (Number(arcNode.getAttribute('x'))+shapeState.origin.x)-groupProp.x;
    var y = (Number(arcNode.getAttribute('y'))+shapeState.origin.y)-groupProp.y;
    arcNode.setAttribute('x',x);
    arcNode.setAttribute('y',y);
    shapeNodes.appendChild(pathNode);
  } else if(shape.getAttribute('locked','0')=='1') {
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
         } else {
           pathChildrenXml[j].setAttribute('x1',Number(pathChildrenXml[j].getAttribute('x1','0'))+(shapeState.origin.x - groupProp.x));
           pathChildrenXml[j].setAttribute('y1',Number(pathChildrenXml[j].getAttribute('y1','0'))+(shapeState.origin.y - groupProp.y));
           pathChildrenXml[j].setAttribute('x2',Number(pathChildrenXml[j].getAttribute('x2','0'))+(shapeState.origin.x - groupProp.x));
           pathChildrenXml[j].setAttribute('y2',Number(pathChildrenXml[j].getAttribute('y2','0'))+(shapeState.origin.y - groupProp.y));
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
StencilManager.prototype.createCurveNode = function(shape, groupProp) {
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
  Questo metodo crea un nodo XML che descrive un'immagine.
  @param shape rappresentazione grafica dell'immagine'
  @param groupProp proprietà della selezione degli elementi
  @return nodo xml che rappresenta l'immagine
*/
StencilManager.prototype.createImageNode = function(shape, groupProp) {
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
StencilManager.prototype.createPointConstraintNode = function(point, groupProp) {
  var constraintNode = this.xmlDoc.createElement('constraint');
  var attachedPointGeo = point.getGeometry();

  var x = ((attachedPointGeo.x+attachedPointGeo.width/2)-groupProp.x)/groupProp.w;
  var y = ((attachedPointGeo.y+attachedPointGeo.height/2)-groupProp.y)/groupProp.h;

  constraintNode.setAttribute('x', x);
  constraintNode.setAttribute('y', y);
  constraintNode.setAttribute('name','P'+point.id+'_'+point.getAttribute('label',''));
  constraintNode.setAttribute('perimeter',0);

  return constraintNode;
}

/**
  Questo metodo restituisce una lista di punti di attacco, disposti lungo una linea
  passata come parametro.
  @param line oggetto che rappresenta la linea sulla quale disporre i punti di attacco
  @param groupProp prorietà geometriche degli oggetti da trasformare
*/
StencilManager.prototype.createLineConstraintNode = function(line, groupProp) {
  var points = line.getAllPoints();
  var attachmentlineNode = this.xmlDoc.createDocumentFragment();
  var constraintNodes = this.xmlDoc.createDocumentFragment();

  var linePoints = [];
  var i;
  for(i=0; i<points.length-1; i++) {
    //Setto la posizione relativa allo stencil da creare
    var x1 = (points[i].x-groupProp.x);
    var y1 = (points[i].y-groupProp.y);
    var x2 = (points[i+1].x-groupProp.x);
    var y2 = (points[i+1].y-groupProp.y);

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
  var lineSpecNode = this.xmlDoc.createElement('attachmentline');
  lineSpecNode.setAttribute('x', this.graph.compress(JSON.stringify(linePoints)));
  attachmentlineNode.appendChild(lineSpecNode);
  attachmentlineNode.appendChild(constraintNodes);
  return attachmentlineNode;
}

/**
  Questo metodo restituisce una lista di punti di attacco, disposti lungo una curva
  passata come parametro.
  @param curve oggetto che rappresenta la curva sulla quale disporre i punti di attacco
  @param groupProp prorietà geometriche degli oggetti da trasformare
*/
StencilManager.prototype.createCurveConstraintNode = function(curve, groupProp) {
  var points = curve.getAllPoints();
  var curveLineNode = this.xmlDoc.createDocumentFragment();
  var constraintNodes = this.xmlDoc.createDocumentFragment();

  var relativeP = [];
  var i;

  for(i=0; i<points.length; i++) {
    var p = {x:0,y:0};
    p.x = (points[i].x-groupProp.x);
    p.y = (points[i].y-groupProp.y);
    relativeP.push(p);
  }

  if(points.length==2) {
    return createLineConstraintNode(curve, groupProp);
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
  var curveSpecNode = this.xmlDoc.createElement('attachmentcurve');
  curveSpecNode.setAttribute('x', this.graph.compress(JSON.stringify(relativeP)));
  curveLineNode.appendChild(curveSpecNode);
  curveLineNode.appendChild(constraintNodes);
  return curveLineNode;
}

/**
  Questo metodo restituisce una lista di punti di attacco, disposti all'interno
  di un simbolo passato come parametro
  @param area oggetto che rappresenta il simbolo nel quale disporre i punti di attacco
  @param groupProp prorietà geometriche degli oggetti da trasformare
*/
StencilManager.prototype.createAreaConstraintNode = function(area, groupProp) {
  var stencil = this.graph.getCellStyle(area)[mxConstants.STYLE_SHAPE];
  //Creo un canvas
  var ctx = this.createCanvas(area);
  var relX = area.getGeometry().x - groupProp.x;
  var relY = area.getGeometry().y - groupProp.y;

  //Per ogni punto controllo se tale punto è nel path
  var constraintNode = this.xmlDoc.createDocumentFragment();
  var areaWidth = area.getGeometry().width;
  var areaHeight = area.getGeometry().height;
  //Informazioni sull'area per l'unmerge
  var attachmentareaNode = this.xmlDoc.createElement('attachmentarea');
  attachmentareaNode.setAttribute('stencil', stencil);
  attachmentareaNode.setAttribute('x', 'P'+relX);
  attachmentareaNode.setAttribute('y', 'P'+relY);
  attachmentareaNode.setAttribute('w', areaWidth);
  attachmentareaNode.setAttribute('h', areaHeight);
  attachmentareaNode.setAttribute('area', 1);
  constraintNode.appendChild(attachmentareaNode);
  var row;
  var col;
  for(row=0;row<=areaWidth;row=row+5) {
    for(col=0;col<=areaHeight;col=col+5) {
      if(ctx.isPointInPath(row,col,'evenodd') || ctx.isPointInStroke(row,col)) {
        var cn = this.xmlDoc.createElement('constraint');
        cn.setAttribute('x', (relX+row)/groupProp.w);
        cn.setAttribute('y', (relY+col)/groupProp.h);
        cn.setAttribute('name','A'+area.id+'_'+area.getAttribute('label',''));
        cn.setAttribute('perimeter',0);
        constraintNode.appendChild(cn);
      }
    }
  }
  return constraintNode;
}

/**
 *  Questa funzione restituisce un frammento XML contenente i punti di attacco sul contorno di uno stencil
 *  @param shape stencil di cui si vogliono rappresentare in XML i punto di attacco del contorno
 *  @param groupProp oggetto contenente le informazioni geometriche del gruppo di simboli da trasformare in XML
 */
StencilManager.prototype.createStencilOutlineConstraintNode = function(shape, groupProp) {
    var geo = shape.getGeometry();
    var constraintNodes = this.xmlDoc.createDocumentFragment();
    var x = geo.x-groupProp.x;
    var y = geo.y-groupProp.y;

    var attachmentareaNode = this.xmlDoc.createElement('attachmentarea');
    attachmentareaNode.setAttribute('stencil', this.graph.getCellStyle(shape)[mxConstants.STYLE_SHAPE]);
    attachmentareaNode.setAttribute('x', 'P'+x);
    attachmentareaNode.setAttribute('y', 'P'+y);
    attachmentareaNode.setAttribute('w', geo.width);
    attachmentareaNode.setAttribute('h', geo.height);
    attachmentareaNode.setAttribute('area', '0');
    constraintNodes.appendChild(attachmentareaNode);
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

/**
  Questo metodo restituisce un punto sulla curva definita dai punti passati come parametro.

*/
StencilManager.prototype.getPointOnQuadCurve = function(t, p1, p2, p3) {
	var t2 = (1-t)*(1-t);
	var t3 = 2*(1-t)*t;
	var t4 = t*t;
	var x = t2 * p1.x + t3 * p2.x + t4 * p3.x;
	var y = t2 * p1.y + t3 * p2.y + t4 * p3.y;
	return ({x: x,y: y});
}

/**
  Questo metodo traduce uno stencil (XML) passato come parametro, in un insieme
  di simboli (rappresentati da oggetti mxCell)
  @param cellToTransform stencil XML da trasformare
*/
StencilManager.prototype.unmergeShape = function(cellToTransform) {
  var geoCell = cellToTransform.getGeometry();

  var stencil = this.graph.getCellStyle(cellToTransform)[mxConstants.STYLE_SHAPE];
  var shapeXml;
  //Se lo stencil è definito in base64, effettuo il decode per ottenere l'xml
  if(stencil.includes('stencil(')) {
    var base64 = stencil.substring(8, stencil.length-1);
    var desc = this.graph.decompress(base64);
    shapeXml = mxUtils.parseXml(desc).documentElement;
  } else {
    /*
    Se lo stencil è definito da un nome, allora è presente nello mxStencilRegistry.
    Da lì posso ottenere l'xml.
    */
    shapeXml = mxStencilRegistry.getStencil(stencil).desc;
  }
  var cellsToAdd = []; //Lista dei simboli componenti da aggiungere all'editor
  var lastCells = []; //Simboli inserite nell'ultima iterazione (necessario per modificare lo stile)

  var xmlShapeGeo = {width: shapeXml.getAttribute('w', geoCell.width), height: shapeXml.getAttribute('h', geoCell.height)};
  var connectionsNode = shapeXml.getElementsByTagName('connections')[0];
  var connectionChildNodes = this.getAllElementChildNodes(connectionsNode);

  var i;
  var inArea = false;
  for(i=0; i<connectionChildNodes.length; i++) {
    var node = connectionChildNodes[i];
    if(node.tagName == 'constraint' && (!inArea || node.getAttribute('name')==null || node.getAttribute('name','P')[0] == 'P')) {
      inArea = false;
      var x = node.getAttribute('x')*xmlShapeGeo.width+geoCell.x-2.5;
      var y = node.getAttribute('y')*xmlShapeGeo.height+geoCell.y-2.5;
      var doc = mxUtils.createXmlDocument();
      var nodeCell = doc.createElement('AttachmentSymbol');
      if(node.getAttribute('name')!=null) {
        var name = node.getAttribute('name','');
        var match = name.match(/^P{1}[0123456789]*_/g);
        var index = 0;
        if(match!=null) {
          index = match[0].length;
        }
		    nodeCell.setAttribute('label', name.substring(index, name.length));
      } else {
        nodeCell.setAttribute('label', '');
      }
			nodeCell.setAttribute('isConstraint', 1);
      var cell = new mxCell(nodeCell, new mxGeometry(x, y, 5, 5), 'ellipse;rotatable=0;resizable=0;fillColor=#d5e8d4;strokeColor=#80FF00;strokeWidth=0;');
      cell.vertex = true;
      cell.connectable = false;
      //cell.visible = false;
      cellsToAdd.push(cell);
    } else if(node.tagName == 'attachmentline' || node.tagName == 'attachmentcurve') {
      inArea = true;
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
      var nodeCell = doc.createElement('AttachmentSymbol');
      if(node.nextElementSibling.getAttribute('name')!=null) {
        var name = node.nextElementSibling.getAttribute('name','');
        var match = name.match(/^(L|C){1}[0123456789]*_/g);
        var index = 0;
        if(match!=null) {
          index = match[0].length;
        }
		    nodeCell.setAttribute('label', name.substring(index, name.length));
      } else {
        nodeCell.setAttribute('label', '');
      }
			nodeCell.setAttribute('isConstraint', 1);
      var style;
      if(node.tagName == 'attachmentline') {
        style = 'endArrow=none;html=1;rounded=0;rotatable=0;resizable=0;fillColor=#d5e8d4;strokeColor=#80FF00;strokeWidth=2;opacity=70;';
      } else {
        style = 'curved=1;endArrow=none;html=1;rotatable=0;resizable=0;fillColor=#CDEB8B;strokeColor=#80FF00;strokeWidth=2;opacity=70;';
      }
      var cell = new mxCell(nodeCell, lineGeometry, style);
      cell.edge = true;
      cell.connectable = false;
      //cell.visible = false;
      cellsToAdd.push(cell);
    } else if(node.tagName == 'attachmentarea') {
      inArea = true;
      var stencil = node.getAttribute('stencil');
      var sourcePoint_x = geoCell.x+Number(node.getAttribute('x').substring(1));
      var sourcePoint_y = geoCell.y+Number(node.getAttribute('y').substring(1));
      var dimension_w = Number(node.getAttribute('w'));
      var dimension_h = Number(node.getAttribute('h'));
      var areaGeometry = new mxGeometry(sourcePoint_x, sourcePoint_y, dimension_w, dimension_h);
      var doc = mxUtils.createXmlDocument();
      var nodeCell = doc.createElement('AttachmentSymbol');
      if(node.nextElementSibling.getAttribute('name')!=null) {
        var name = node.nextElementSibling.getAttribute('name','');
        var match = name.match(/^A{1}[0123456789]*_/g);
        var index = 0;
        if(match!=null) {
          index = match[0].length;
        }
		    nodeCell.setAttribute('label', name.substring(index, name.length));
      } else {
        nodeCell.setAttribute('label', '');
      }
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
      //cell.visible = false;
      cellsToAdd.push(cell);
    }
  }
  var backgroundNode = shapeXml.getElementsByTagName('background')[0];
  cellsToAdd = cellsToAdd.concat(this.getShapeFromXml(backgroundNode, geoCell, xmlShapeGeo));
  var foregroundNode = shapeXml.getElementsByTagName('foreground')[0];
  cellsToAdd = cellsToAdd.concat(this.getShapeFromXml(foregroundNode, geoCell, xmlShapeGeo));

  this.graph.getModel().beginUpdate();
  cellsToAdd = this.graph.addCells(cellsToAdd);
  this.graph.removeCells([cellToTransform]);
  this.graph.getModel().endUpdate();
  this.graph.refresh();
  return cellsToAdd;
}

/**
  Questo metodo traduce i tag XML in shape.
*/
StencilManager.prototype.getShapeFromXml = function(parentNode, shapeGeo, xmlShapeGeo) {
  var parentChildNodes = this.getAllElementChildNodes(parentNode);
  var childCells = [];
  var styleCell = [];
  var i;
  for(i=0; i<parentChildNodes.length; i++) {
    var node = parentChildNodes[i];

    var groupProp;
    if(node.tagName == 'image') {
      lastCells = [];
      var cell = new mxCell();
      cell.setGeometry(new mxGeometry(Number(node.getAttribute('x'))+shapeGeo.x, Number(node.getAttribute('y'))+shapeGeo.y, Number(node.getAttribute('w')), Number(node.getAttribute('h'))));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_SHAPE, 'image');
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_IMAGE, node.getAttribute('src').replace(';base64',''));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_STROKEWIDTH, 1);
      cell.vertex = true;
      cell.connectable = false;
      childCells.push(cell);
      lastCells.push(cell);
    } else if(node.tagName == 'include-shape') {
      lastCells = [];
      var cell = new mxCell();
      cell.setGeometry(new mxGeometry(Number(node.getAttribute('x'))+shapeGeo.x, Number(node.getAttribute('y'))+shapeGeo.y, Number(node.getAttribute('w')), Number(node.getAttribute('h'))));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_SHAPE, node.getAttribute('name'));
      cell.vertex = true;
      cell.connectable = false;
      childCells.push(cell);
      lastCells.push(cell);
    } else if(node.tagName == 'rect') {
      lastCells = [];
      var cell = new mxCell();
      cell.setGeometry(new mxGeometry(Number(node.getAttribute('x'))+shapeGeo.x, Number(node.getAttribute('y'))+shapeGeo.y, Number(node.getAttribute('w')), Number(node.getAttribute('h'))));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_SHAPE, 'mxgraph.general.rectangle');
      cell.vertex = true;
      cell.connectable = false;
      childCells.push(cell);
      lastCells.push(cell);
    } else if(node.tagName == 'ellipse') {
      lastCells = [];
      var cell = new mxCell();
      cell.setGeometry(new mxGeometry(Number(node.getAttribute('x'))+shapeGeo.x, Number(node.getAttribute('y'))+shapeGeo.y, Number(node.getAttribute('w')), Number(node.getAttribute('h'))));
      cell.style = mxUtils.setStyle(cell.style, mxConstants.STYLE_SHAPE, 'mxgraph.general.circle');
      cell.vertex = true;
      cell.connectable = false;
      childCells.push(cell);
      lastCells.push(cell);
    } else if(node.tagName == 'path') {
      lastCells = [];
      var pathNodes = this.getAllElementChildNodes(node);

      var sourcePoint;
      var controlPoint = [];
      var terminalPoint;

      var currentPoint;
      var prevPoint;
      var movePoint;
      var isLine = false;
      var isCurve = false;

      var j;
      for(j=0; j<pathNodes.length; j++) {

        if(pathNodes[j].tagName == 'move') {
          currentPoint = new mxPoint(Number(pathNodes[j].getAttribute('x'))+shapeGeo.x, Number(pathNodes[j].getAttribute('y'))+shapeGeo.y);
          movePoint = currentPoint;
        } else if(pathNodes[j].tagName == 'line') {
          currentPoint = new mxPoint(Number(pathNodes[j].getAttribute('x'))+shapeGeo.x, Number(pathNodes[j].getAttribute('y'))+shapeGeo.y);
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
            childCells.push(cell);
            lastCells.push(cell);
          }
        } else if(pathNodes[j].tagName == 'quad') {
          var point1 = new mxPoint(Number(pathNodes[j].getAttribute('x1'))+shapeGeo.x, Number(pathNodes[j].getAttribute('y1'))+shapeGeo.y);
          currentPoint = new mxPoint(Number(pathNodes[j].getAttribute('x2'))+shapeGeo.x, Number(pathNodes[j].getAttribute('y2'))+shapeGeo.y);
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
          childCells.push(cell);
          lastCells.push(cell);
        } else if(pathNodes[j].tagName == 'curve') {
          var point1 = new mxPoint(Number(pathNodes[j].getAttribute('x1'))+shapeGeo.x, Number(pathNodes[j].getAttribute('y1'))+shapeGeo.y);
          var point2 = new mxPoint(Number(pathNodes[j].getAttribute('x2'))+shapeGeo.x, Number(pathNodes[j].getAttribute('y2'))+shapeGeo.y);
          currentPoint = new mxPoint(Number(pathNodes[j].getAttribute('x3'))+shapeGeo.x, Number(pathNodes[j].getAttribute('y3'))+shapeGeo.y);

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
          controlPoint.push(point2);
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
          childCells.push(cell);
          lastCells.push(cell);
        } else if(pathNodes[j].tagName == 'arc') {
          var arcShapeDocument = mxUtils.createXmlDocument();
          var arcRootNode = arcShapeDocument.createElement('shape');
          arcRootNode.setAttribute('h',xmlShapeGeo.height);
          arcRootNode.setAttribute('w',xmlShapeGeo.width);
          arcRootNode.setAttribute('aspect','variable');
          arcRootNode.setAttribute('strokewidth','inherit');
          var arcForegroundNode = arcShapeDocument.createElement('foreground');
          var arcPathNode = arcShapeDocument.createElement('path');
          var arcMoveNode = arcShapeDocument.createElement('move');
          arcMoveNode.setAttribute('x',currentPoint.x-shapeGeo.x);
          arcMoveNode.setAttribute('y',currentPoint.y-shapeGeo.y);
          arcPathNode.appendChild(arcMoveNode);
          arcPathNode.appendChild(pathNodes[j].cloneNode(true));
          arcForegroundNode.appendChild(arcPathNode);
          arcForegroundNode.appendChild(arcShapeDocument.createElement('fillstroke'));
          arcRootNode.appendChild(arcForegroundNode);
          var stencilName = 'arc'+this.graph.getModel().nextId+'_'+j+'_'+i;
          mxStencilRegistry.addStencil(stencilName, new mxStencil(arcRootNode));
          var arcBase64 = this.graph.compress(mxUtils.getXml(arcRootNode));
          var cell = new mxCell();
          var newGeo = new mxGeometry(shapeGeo.x, shapeGeo.y, xmlShapeGeo.width, xmlShapeGeo.height);
          cell.setGeometry(newGeo);
          cell.style = 'shape='+stencilName+';';
          cell.vertex = true;
          childCells.push(cell);
          lastCells.push(cell);
          currentPoint = new mxPoint(Number(pathNodes[j].getAttribute('x'))+shapeGeo.x, Number(pathNodes[j].getAttribute('y'))+shapeGeo.y);
        } else if(pathNodes[j].tagName == 'close') {
          var cell = new mxCell();
          var newGeo = new mxGeometry();
          newGeo.sourcePoint = currentPoint;
          newGeo.targetPoint = movePoint;
          newGeo.width = 1;
          newGeo.height = 1;
          newGeo.relative = true;
          cell.setGeometry(newGeo);
          cell.style = 'endArrow=none;curved=0;rounded=0;';
          cell.edge = true;
          cell.vertex = true;
          childCells.push(cell);
          lastCells.push(cell);
        }
        prevPoint = currentPoint;
      }

    } else if(node.tagName == 'fillstroke' || node.tagName == 'stroke') {
      if(styleCell.length>0) {
        this.addAttrStyleCells(lastCells, styleCell);
        styleCell = [];
      }
    } else if(node.tagName == 'dashed') {
      if(node.getAttribute('dashed')=='1') {
        var dashedPattern;
        if(node.nextElementSibling.tagName == 'dashpattern') {
          styleCell.push({name: 'dashPattern', value: node.nextElementSibling.getAttribute('pattern')});
        }
        styleCell.push({name: mxConstants.STYLE_DASHED, value: 1});
      }
    } else if(node.tagName == 'strokewidth') {
      styleCell.push({name: mxConstants.STYLE_STROKEWIDTH, value: node.getAttribute('width')});
    } else if(node.tagName == 'strokecolor') {
      styleCell.push({name: mxConstants.STYLE_STROKECOLOR, value: node.getAttribute('color')});
    } else if(node.tagName == 'fillcolor') {
      styleCell.push({name: mxConstants.STYLE_FILLCOLOR, value: node.getAttribute('color')});
    } else {
      continue;
    }
  }
  return childCells;
}
/*
 *  Questo funzione restituisce tutti i nodi XML figli che non sono testo
 */
StencilManager.prototype.getAllElementChildNodes = function(parent) {
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
StencilManager.prototype.addAttrStyleCells = function(cells, style) {
  var i;
  for(i=0; i<cells.length; i++) {
    var j;
    for(j=0; j<style.length; j++) {
      cells[i].style = mxUtils.setStyle(cells[i].style, style[j].name, style[j].value);
    }
  }
}
