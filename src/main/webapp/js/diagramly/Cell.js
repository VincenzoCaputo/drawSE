//Specifica se il simbolo è un punto di attacco
mxCell.prototype.constraint = -1;
//Specifica se il simbolo ha un'area di attacco
mxCell.prototype.areaConstraint = -1;
//Specifica se il simbolo ha un contorno di attacco
mxCell.prototype.outlineConstraint = -1
//Specifica il colore dell'area di attacco
mxCell.prototype.areaConstraintColor = '#FFFFFF'
//Specifica il colore del contorno d'attacco
mxCell.prototype.outlineConstraintColor = '#000000'
//Specifica il colore di riempimento del simbolo
mxCell.prototype.fillColor = '#FFFFFF'
//Specifica il colore di contorno del simbolo
mxCell.prototype.strokeColor = '#000000'

/**
 * Questa funzione restituisce true se il simbolo è un punto di attacco, false altrimenti
 */
mxCell.prototype.isConstraint = function() {
  if(this.constraint<0) {
    this.constraint = this.getAttribute('isConstraint',0);
  }
  if(this.constraint==0) {
    return false;
  } else if(this.constraint==1) {
    return true;
  }
}

mxCell.prototype.setConstraint = function() {
  if(this.getValue()=='' || this.getValue()==null) {
    var node = this.createAttackSymbolXmlNode();
    node.setAttribute('isConstraint', 1);
    this.setValue(node);
    console.log(node);
  } else {
    this.setAttribute('isConstraint',1);
    console.log(this.value);
  }

}
/**
 *  Questa funzione restituisce true se il simbolo ha un'area di attacco, false altrimenti
 */
mxCell.prototype.isAreaConstraint = function() {
  if(this.areaConstraint<0) {
    this.areaConstraint = this.getAttribute('areaConstraint',0);
  }
  if(this.areaConstraint==0) {
    return false;
  } else if(this.areaConstraint==1) {
    return true;
  }
}

/**
 *  Questa funzione imposta il flag areaConstraint del simbolo a 1
 */
mxCell.prototype.addAreaConstraint = function() {
  if(this.getValue()=='') {
    var node = this.createSymbolXmlNode();
    node.setAttribute('areaConstraint', 1);
    this.setValue(node);
  } else {
    this.setAttribute('areaConstraint',1);
  }
  this.areaConstraint = 1;
  this.setAreaConstraintColor('#CCFF00');
}

/**
 *  Questa funzione imposta il flag areaConstraint del simbolo a 0
 */
mxCell.prototype.removeAreaConstraint = function() {
  this.setAttribute('areaConstraint',0);
  this.areaConstraint = 0;
  this.setAreaConstraintColor('#FFFFFF');
}

/**
 *  Questa funzione restituisce true se il simbolo ha un contorno d'attacco, false altrimenti
 */
mxCell.prototype.isOutlineConstraint = function() {
  if(this.outlineConstraint<0) {
    this.outlineConstraint = this.getAttribute('outlineConstraint',0);
  }
  if(this.outlineConstraint==0) {
    return false;
  } else if(this.outlineConstraint==1) {
    return true;
  }
}

/**
 *  Questa funzione permette di settare il flag relativo al contorno d'attacco a 1
 */
mxCell.prototype.addOutlineConstraint = function() {
   if(this.getValue()=='') {
     var node = this.createSymbolXmlNode();
     node.setAttribute('outlineConstraint', 1);
     this.setValue(node);
   } else {
     this.setAttribute('outlineConstraint',1);
   }
   this.outlineConstraint = 1;
   this.setOutlineConstraintColor('#80FF00');
 }

 /**
  *  Questa funzione permette di settare il flag relativo al contorno d'attacco a 0
  */
mxCell.prototype.removeOutlineConstraint = function() {
    this.setAttribute('outlineConstraint',0);
    this.outlineConstraint = 0;
    this.setOutlineConstraintColor('#000000');
  }

mxCell.prototype.setFillColor = function(fillColor) {
  if(this.getValue()=='') {
    var node = this.createSymbolXmlNode();
    node.setAttribute('fillColor', fillColor);
    this.setValue(node);
  } else {
    this.setAttribute('fillColor', fillColor);
  }
  this.fillColor = fillColor;
}

mxCell.prototype.setStrokeColor = function(strokeColor) {
  if(this.getValue()=='') {
    var node = this.createSymbolXmlNode();
    node.setAttribute('strokeColor', strokeColor);
    this.setValue(node);
  } else {
    this.setAttribute('strokeColor', strokeColor);
  }
  this.strokeColor = strokeColor;
}

mxCell.prototype.setAreaConstraintColor = function(fillColor) {
  if(this.getValue()=='') {
    var node = this.createSymbolXmlNode();
    node.setAttribute('areaConstraintColor', fillColor);
    this.setValue(node);
  } else {
    this.setAttribute('areaConstraintColor', fillColor);
  }
  this.areaConstraintColor = fillColor;
}

mxCell.prototype.setOutlineConstraintColor = function(fillColor) {
  if(this.getValue()=='') {
    var node = this.createSymbolXmlNode();
    node.setAttribute('outlineConstraintColor', fillColor);
    this.setValue(node);
  } else {
    this.setAttribute('outlineConstraintColor', fillColor);
  }
  this.outlineConstraintColor = fillColor;
}

mxCell.prototype.createAttackSymbolXmlNode = function() {
  var doc = mxUtils.createXmlDocument();
  var node = doc.createElement('AttackSymbol');
  node.setAttribute('label', '');
  return node;
}

mxCell.prototype.createSymbolXmlNode = function() {
  var doc = mxUtils.createXmlDocument();
  var node = doc.createElement('Symbol');
  node.setAttribute('label', '');
  return node;
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
  if(this.getStyle().includes('group')){
    return this.GROUP_SHAPE_TYPE;
  } else if(this.getStyle().includes('curved=1')) {
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
mxCell.prototype.GROUP_SHAPE_TYPE = 'group';
