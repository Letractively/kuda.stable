/* 
 * Kuda includes a library and editor for authoring interactive 3D content for the web.
 * Copyright (C) 2011 SRI International.
 *
 * This program is free software; you can redistribute it and/or modify it under the terms
 * of the GNU General Public License as published by the Free Software Foundation; either 
 * version 2 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program; 
 * if not, write to the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, 
 * Boston, MA 02110-1301 USA.
 */

var editor = (function(module) {
	module.ui = module.ui || {};
	
	var MAX_TXT = 'Maximize',
		MIN_TXT = 'Minimize';
		
	module.EventTypes = module.EventTypes || {};
	
	// sidebar widget specific
	module.EventTypes.SBWidgetVisible = "sidebar.SBWidgetVisible";
	module.EventTypes.SBWidgetInvalidate = "sidebar.SBWidgetInvalidate";
	module.EventTypes.SBWidgetLoaded = "sidebar.SBWidgetLoaded";
	
	// sidebar specific
	module.EventTypes.SidebarMinimized = "sidebar.SidebarMinimized";
	module.EventTypes.SidebarFinishedLoading = "sidebar.SidebarFinishedLoading";
   
////////////////////////////////////////////////////////////////////////////////
//                     				Sidebar				                   	  //
////////////////////////////////////////////////////////////////////////////////     
	
	module.ui.SidebarDefaults = {
		containerId: 'sidebar'
	};
	
	module.ui.Sidebar = module.ui.Component.extend({
		init: function(options) {		
			var newOpts = jQuery.extend({}, module.ui.SidebarDefaults, options);
			this.widgets = [];
			this.waitingToAdd = [];
			this.visibleWidgets = [];
			this.minimized = false;
				
			this._super(newOpts);
		},
		
		finishLayout: function() {
			this.container = jQuery('#' + this.config.containerId);
			this.minMaxBtn = jQuery('<button id="minMaxBtn">Minimize</button>');
			var sidebar = this,
				sizeFcn = function() {
					// size the container
					var	col = jQuery('#column3'),
						win = jQuery(window),
						sbr = sidebar.container,
						
						colHeight = col.innerHeight(),		
						colPadding = parseInt(col.css('paddingTop')) 
							+ parseInt(col.css('paddingBottom')),
						sbrPadding = parseInt(sbr.css('paddingTop')) 
							+ parseInt(sbr.css('paddingBottom')),
						
						newHeight = colHeight - colPadding - sbrPadding;
						sbr.height(newHeight);
				};
			
			this.container.append(this.minMaxBtn);
			
			this.minMaxBtn.bind('click', function(evt) {
				if (sidebar.minimized) {
					sidebar.maximize();
				}
				else {
					sidebar.minimize();
				}
				
				jQuery(window).trigger('resize');
			});
			
			sizeFcn();					
			jQuery('#o3d').bind('editor.mainView.resize', function(evt) {
				sizeFcn();
				sidebar.layoutWidgets();
			});
		},
		
		addWidget: function(widget) {
			if (widget instanceof module.ui.SidebarWidget) {
				var widgetUI = widget.getUI(),
					sidebar = this,
					list = sidebar.widgets,
					waiting = sidebar.waitingToAdd,
					inList = jQuery.inArray(widget, list) !== -1;
				
				if (!inList) {
					var appendWidgets = function(){
						for (var ndx = 0, len = list.length; ndx < len; ndx++) {
							sidebar.container.append(list[ndx].getUI());
						}
						
						waiting = [];
						sidebar.notifyListeners(
							module.EventTypes.SidebarFinishedLoading, null);
					};
					
					if (!widgetUI) {
						widget.addListener(module.EventTypes.SBWidgetLoaded, 
							function(wgt){
								var ndx = jQuery.inArray(wgt, waiting);
								
								waiting.splice(ndx, 1);
								
								if (waiting.length === 0) {
									appendWidgets();
								}
							});
						waiting.push(widget);
					}
					
					list.push(widget);
					
					widget.addListener(module.EventTypes.SBWidgetVisible, this);
					widget.addListener(module.EventTypes.SBWidgetInvalidate, 
						this);
					
					if (waiting.length === 0) {
						appendWidgets();
					}
				}
			}
		},
		
		removeWidget: function(widget) {
	        var found = null;
	        var ndx = this.widgets.indexOf(widget);
	        
	        if (ndx != -1) {
	            var spliced = this.widgets.splice(ndx, 1);
	            
	            if (spliced.length == 1) {
	                found = spliced[0];
					found.getUI().remove();
	            }
	        }
	        
			found.removeListener(module.EventTypes.SBWidgetVisible, this);
			found.removeListener(module.EventTypes.SBWidgetInvalidate, this);
	        return found;
		},
		
		minimize: function() {
			this.minimized = true;
			this.minMaxBtn.text(MAX_TXT).addClass('minimized');
			this.container.addClass('minimized');
			var visWgts = this.visibleWidgets;
			this.minimizedWidgets = [];
			
			for (var ndx = 0, len = visWgts.length; ndx < len; ndx++) {
				this.minimizedWidgets.push(visWgts[ndx]);
			}
			
			for (var ndx = 0, len = this.minimizedWidgets.length; ndx < len; ndx++) {
				this.minimizedWidgets[ndx].setVisible(false);
			}
			
			this.notifyListeners(module.EventTypes.SidebarMinimized, true);
		},
		
		maximize: function() {
			this.minimized = false;
			this.minMaxBtn.text(MIN_TXT).removeClass('minimized');
			this.container.removeClass('minimized');			
			
			for (var ndx = 0, len = this.minimizedWidgets.length; ndx < len; ndx++) {
				this.minimizedWidgets[ndx].setVisible(true);
			}
			
			this.notifyListeners(module.EventTypes.SidebarMinimized, false);
		},
		
		notify: function(eventType, value) {
			if (eventType === module.EventTypes.SBWidgetVisible) {
				var visible = value.visible,
					widget = value.widget;
					
				if (visible) {
					if (jQuery.inArray(widget, this.visibleWidgets) === -1) {
						this.visibleWidgets.push(widget);
					}
				}
				else {
					var ndx = jQuery.inArray(widget, this.visibleWidgets);
					
					if (ndx !== -1) {
						this.visibleWidgets.splice(ndx, 1);
					}
				}
				this.layoutWidgets();
			}
			else if (eventType === module.EventTypes.SBWidgetInvalidate) {
				this.layoutWidgets();
			}
		},
		
		layoutWidgets: function() {
			// get the visible widgets
			var visWgts = this.visibleWidgets;
			
			// size the visible widgets
			var len = visWgts.length,	
				ctr = this.container,	
				
				ctrHeight = ctr.innerHeight(),
				ctrPadding = Math.ceil(parseFloat(ctr.css('paddingTop'))) 
					+ Math.ceil(parseFloat(ctr.css('paddingBottom'))),
				minBtnHeight = this.minMaxBtn.outerHeight(true),
			
				newHeight = ctrHeight - ctrPadding - minBtnHeight,
				wgtMax = newHeight / len;
				
			// get the append ordering instead of who setvisible() last
			var wgts = this.widgets,
				found = false,
				ordered = [];
			
			for (var ndx = 0, wlen = wgts.length; ndx < wlen; ndx++) {
				found = false;
				
				for (var ndx2 = 0, len2 = visWgts.length; ndx2 < len2 && !found; 
						ndx2++) {
					if (found = (visWgts[ndx2] === wgts[ndx])) {
						ordered.push(visWgts[ndx2]);
					}
				}
			}
			
			for (var ndx = 0; ndx < len; ndx++) {
				var wgt = ordered[ndx],
				
					// get the preferred size
					preferred = wgt.getPreferredHeight();
					
				if (preferred > 0 && preferred < wgtMax) {
					wgt.resize(preferred);
					wgtMax = newHeight / (len - ndx - 1);
				}
				else {
					wgt.resize(wgtMax);
				}
				
				// reset classes
				wgt.getUI().removeClass('first').removeClass('last');
			}
			
			// set classes for first and last visible widget
			if (len > 0) {				
				ordered[0].getUI().addClass('first');
				ordered[ordered.length - 1].getUI().addClass('last');
			}
		}
	});
   
////////////////////////////////////////////////////////////////////////////////
//                     			Sidebar Widget			                   	  //
////////////////////////////////////////////////////////////////////////////////     
	
	
	module.ui.SidebarWidgetDefaults = {
		name: '',
		manualVisible: false
	};
	
	module.ui.SidebarWidget = module.ui.Component.extend({
		init: function(options) {		
			var newOpts = jQuery.extend({}, module.ui.SidebarWidgetDefaults, options);
			var widgets = [];
			this.preferredHeight = 0;
			this.currentView = null;
			
			this._super(newOpts);
		},
		
		finishLayout: function() {
			var wgt = this;
			
			if (!this.container) {
				this.container = jQuery('<div></div>');
			}
			
			this.container.addClass('sidebarWidget');			
			this.setVisible(false);
			this.find('form').addClass('sidebarForm');
		},
		
		load: function() {
			var cmp = this;

			if (this.config.uiFile && this.config.uiFile !== '') {
				hemi.loader.loadHtml(this.config.uiFile, function(data) {
					// clean the string of html comments
					var cleaned = data.replace(/<!--(.|\s)*?-->/, '');
					cmp.container = jQuery(cleaned);
					cmp.finishLayout();
					
					cmp.notifyListeners(module.EventTypes.SBWidgetLoaded, cmp);
				});
			}
		},
		
		setVisible: function(visible) {
			this._super(visible);
			var wgt = this;
			
			this.notifyListeners(module.EventTypes.SBWidgetVisible, {
				widget: wgt,
				visible: visible
			});
		},
		
		resize: function(maxHeight) {
			var ctn = this.container,
				form = ctn.find('form'),
				borderHeight = parseInt(ctn.css('borderTopWidth')) 
					+ parseInt(ctn.css('borderBottomWidth')),
				marginHeight = parseInt(ctn.css('marginTop')) 
					+ parseInt(ctn.css('marginBottom')),
				paddingHeight = parseInt(ctn.css('paddingTop')) 
					+ parseInt(ctn.css('paddingBottom')),
				newHeight = maxHeight - borderHeight - marginHeight 
					- paddingHeight;
				
			this.container.height(newHeight);
		},
		
		getPreferredHeight: function() {
			return this.preferredHeight;
		},
		
		invalidate: function() {
			this.notifyListeners(module.EventTypes.SBWidgetInvalidate, null);
		},
		
		getName: function() {
			return this.config.name;
		}
	});
   
////////////////////////////////////////////////////////////////////////////////
//                     	Convenient List Sidebar Widget                   	  //
////////////////////////////////////////////////////////////////////////////////     
	
	/*
	 * Configuration object for the ListSBWidget.
	 */
	module.ui.ListSBWidgetDefaults = {
		name: 'listSBWidget',
		listId: 'list',
		prefix: 'lst',
		title: '',
		instructions: '',
		type: module.ui.ListType.UNORDERED,
		sortable: false
	};
	
	module.ui.ListSBWidget = module.ui.SidebarWidget.extend({
		init: function(options) {
			var newOpts = jQuery.extend({}, module.tools.ListSBWidgetDefaults, options);
		    this._super(newOpts);
			
			this.items = new Hashtable();		
		},
			    
	    add: function(obj) {			
			var itm = this.items.get(obj.getId());
			if (!itm) {
				var li = this.createListItemWidget();
					
				li.setText(obj.name);
				li.attachObject(obj);
				
				this.bindButtons(li, obj);
				
				this.list.add(li);
				this.items.put(obj.getId(), li);
			
				return li;
			}
			
			return itm;
	    },
		
		bindButtons: function() {
			
		},
		
		createListItemWidget: function() {
			return new module.ui.EditableListItemWidget();
		},
		
		getOtherHeights: function() {
			return 0;
		},
		
		finishLayout: function() {
			this._super();
			this.title = jQuery('<h1>' + this.config.title + '</h1>');
			this.instructions = jQuery('<p>' + this.config.instructions + '</p>');
			var wgt = this,
				otherElems = this.layoutExtra();
			
			this.list = new module.ui.ListWidget({
				widgetId: this.config.listId,
				prefix: this.config.prefix,
				type: this.config.type,
				sortable: this.config.sortable
			});
			
			this.container.append(this.title).append(this.instructions)
				.append(this.list.getUI());
				
			if (otherElems !== null) {
				this.instructions.after(otherElems);
			}
		},
		
		layoutExtra: function() {
			return null;
		},
	    
	    remove: function(obj) {
			var li = this.items.get(obj.getId()),
				retVal = false;
			
			if (li) {
				li.removeObject();
				this.list.remove(li);
				this.items.remove(obj.getId());
				retVal = true;
			}
			
			return retVal;
	    },
		
		resize: function(maxHeight) {
			this._super(maxHeight);	
			var list = this.list.getUI(),	
				
			// now determine button container height
				insHeight = this.instructions.outerHeight(true),
			
			// get the header height
				hdrHeight = this.title.outerHeight(true),
				
			// get other heights
				otherHeight = this.getOtherHeights(),
			
			// adjust the list pane height
			 	listHeight = maxHeight - insHeight - hdrHeight - otherHeight;
				
			if (listHeight > 0) {
				list.height(listHeight);
			}
		},
		
		update: function(obj) {
			var li = this.items.get(obj.getId()),
				retVal = false;
			
			if (li) {
				li.setText(obj.name);
				li.attachObject(obj);
				retVal = true;
			}
			
			return retVal;
		}
	});
	
	return module;
})(editor || {});