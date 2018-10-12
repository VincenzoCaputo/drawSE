# About
drawSE is a free to use application for creating diagrams with highly customized symbols. It is built on top of [draw.io](https://www.draw.io) and adds to it functionalities for creating symbols with customized attaching points.

**drawSE can be started by clicking on [this link](https://cluelab.github.io/drawSE/src/main/webapp/index.html).**

## Features
-----
In order to allow to create customized symbols, drawSE provides two editing modes: one for drawing the shape of the symbol (Shape Mode) and one for defining the attaching points of the symbol (AP Mode). The application always starts in Shape Mode and it can be changed to the AP Mode by switching the Mode button in the toolbar (see the figure below).

![Mode switch button](https://raw.githubusercontent.com/cluelab/drawSE/assets/mode_switch.png)

### Shape Mode
-----
The sidebar on the left contains the graphical objects that can be used to compose new symbols. As in draw.io, a user can click on an object and drag it to the canvas. The object can be customized (changing color, line thickness and style, etc.) by using the panel on the right. With respect to draw.io, the new features are:
- setting the fill color of a poly line (open or closed) by choosing the color from the fill element placed in the Style tab of the right sidebar (see the figure below).

![Fill color button](https://raw.githubusercontent.com/cluelab/drawSE/assets/fill_color.png)

- creating a single symbol from a group of objects by selecting two or more objects and, after right clicking, choosing *Make a Symbol* from the context menu.
- splitting a symbol into its original components by selecting the symbol and, after right clicking, choosing *Break up* from the context menu.

### AP Mode
-----
In AP Mode, drawSE provides a palette with seven tools in order to define the attachment points of the symbols in the canvas. The tools can be used to dispose the points in seven geometrical shapes:
- a simple point
- a straight line
- a curved line
- a rectangular area
- an elliptical area
- a rectangular outline
- an elliptical outline

Features of the AP Mode include the possibility of giving a name to an attachment geometrical shapes by selecting it and pressing *F2* on the keyboard or, alternatively, by using the textbox placed in the Arrange tab of right sidebar.
In addition, the AP Mode allows a user to turn an attachment outline into an attachment area. To do this, the user must select an outline or two or more lines sharing an end point in AP Mode and check the *Area constraint* checkbox from the Arrange tab (see the figure below); one can also use the context menu.

![Area constraint checkbox](https://raw.githubusercontent.com/cluelab/drawSE/assets/area_constraint.png)

When switching back to the Shape Mode drawSE automatically updates the symbols with the specified attachment points. When the mouse is passed over the symbol the attachment points are shown as small blue crosses.

**Note:** the work can be saved only in Shape Mode.

### Custom Palettes
-----
Another feature of drawSE consists of the possibility to create custom palettes with new symbols. This can be done by clicking on the *New palette* button in the left sidebar and drag a symbol to it from the canvas. The application then asks the user a name for the newly added symbol.
**Note:** the name of a symbol must be unique.

The pencil icon on the bar (see the figure below) allows to modify the palette content in order to:
- change the palette name
- change a symbol name
- delete a symbol
- export/import the set of symbols in an XML file
- create a symbol from an image url and add it to the palette

A user can import symbols in draw.io from exported symbols created in drawSE and use them to create diagrams as usual.
To import a custom library in draw.io a user can select the *Open library from* option from the *File* menu.

![Palette edit button](https://raw.githubusercontent.com/cluelab/drawSE/assets/palette_pencil.png)

![Palette edit window](https://raw.githubusercontent.com/cluelab/drawSE/assets/palette_edit.png)
