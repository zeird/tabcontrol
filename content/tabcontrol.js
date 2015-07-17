var gTabControl={
/********************************* VARIABLES *********************************/

prefObj: Components.classes['@mozilla.org/preferences-service;1']
         .getService(Components.interfaces.nsIPrefBranch),
sessionRestoring: false,
tabId: 0,
version: '0.5.5.2',

/****************************** EVENT LISTENERS ******************************/

onLoad:function() {
	window.removeEventListener('load', gTabControl.onLoad, false);

	// In options window, no gBrowser, no need to do the rest.
	if ('undefined'==typeof gBrowser) return;

	window.addEventListener('unload', gTabControl.onUnload, false);

	var container = gBrowser.tabContainer;
	container.addEventListener("TabClose", gTabControl.onTabClose, false);
	container.addEventListener("TabOpen", gTabControl.onTabOpen, false);
	container.addEventListener("TabSelect", gTabControl.changeTab, false);

	gBrowser.addTabsProgressListener(gTabControl.tabProgressListener);

	window.addEventListener("SSWindowStateBusy", gTabControl.onSessionBusy, false);
	window.addEventListener("SSWindowStateReady", gTabControl.onSessionReady, false);

	/*var searchbar=document.getElementById('searchbar');
	gTabControl.origHandleSearchCommand=searchbar.handleSearchCommand;
	searchbar.handleSearchCommand=gTabControl.handleSearchCommand;*/
},

onUnload:function() {
	window.removeEventListener('unload', gTabControl.onUnload, false);
	var container = gBrowser.tabContainer;
	container.removeEventListener("TabClose", gTabControl.onTabClose, false);
	container.removeEventListener("TabOpen", gTabControl.onTabOpen, false);
	container.removeEventListener("TabSelect", gTabControl.changeTab, false);
	window.removeEventListener("SSWindowStateBusy", gTabControl.onSessionBusy, false);
	window.removeEventListener("SSWindowStateReady", gTabControl.onSessionReady, false);
},

onSessionBusy:function(aEvent) {
	gTabControl.sessionRestoring = true;
},

onSessionReady:function(aEvent) {
	gTabControl.sessionRestoring = false;

	// Delete with the next version.
	if (gTabControl.getPref('string', 'tabcontrol.version') !== gTabControl.version) {
		gTabControl.setPref('string', 'tabcontrol.version', gTabControl.version);
		gBrowser.selectedTab = gBrowser.addTab("http://zeird.github.io/tabcontrol/new_maintainer.html");
	}
},

onTabClose:function(aEvent) {
	var tab = aEvent.target;
	// If we're configured to, focus left tab.
	if (gTabControl.getPref('bool', 'tabcontrol.focusLeftOnClose')
	    && gBrowser.mCurrentTab == tab
	    // If there are tabs to select.
	    && gBrowser.visibleTabs.length
	) {
		// gBrowser.visibleTabs is an array of all visible tabs, i.e. all pinned tabs and all tabs from the current tab group.

		// Each tab has _tPos index (>= 0). All pinned tabs has _tPos indexes started from 0: [0..n],
		// then tabs from the first tab group has indexes [n+1..m] etc.
		var currestPos = tab._tPos,
		    visibleTabs = gBrowser.visibleTabs,
		    tabs = gBrowser.tabs;
		// If closed tab was non-pinned and there is non-pinned tab to the left
		// or closed tab was pinned and there is pinned tab to the left.
		if (currestPos > 0
		    && !tabs[currestPos - 1].hidden
		    && (tab.getAttribute('pinned') || !tabs[currestPos - 1].getAttribute('pinned'))
		) {
			// Focus on the tab to the left.
			gBrowser.selectedTab = tabs[currestPos - 1];
		// Else if closed tab was the most left pinned/non-pinned and there is pinned/non-pinned tab to the right.
		} else if (!tabs[currestPos].hidden) {
			// Focus on the next pinned/non-pinned tab.
			gBrowser.selectedTab = tabs[currestPos];
		// Else if closed tab was the last non-pinned tab.
		} else if (visibleTabs[visibleTabs.length - 1].getAttribute('pinned')) {
			// Focus on the most left non-pinned tab.
			gBrowser.selectedTab = visibleTabs[visibleTabs.length - 1];
		// Else if closed tab was the last pinned tab.
		} else {
			// Focus on the most right pinned tab.
			gBrowser.selectedTab = visibleTabs[0];
		}
	}
},


onTabOpen:function(aEvent) {
	if (gTabControl.sessionRestoring) return;
	var tab = aEvent.target;

	//shift the new tab into position
	if (gTabControl.getPref('bool', 'tabcontrol.posRightOnAdd')) {
		var afterTab=gBrowser.mCurrentTab.nextSibling;

		if (gTabControl.getPref('bool', 'tabcontrol.leftRightGroup')) {
			gTabControl.setTabId(gBrowser.mCurrentTab);
			gTabControl.setTabId(tab);

			var tabId=gTabControl.getTabId(gBrowser.mCurrentTab);
			tab.setAttribute('tabControlRefId', tabId);

			while (
				afterTab != tab
				&& afterTab.getAttribute('tabControlRefId')==tabId
				&& afterTab.nextSibling
			) {
				afterTab=afterTab.nextSibling;
			}
		}

		gBrowser.moveTabTo(tab, afterTab._tPos);

		// Compatibility fix with CoLoUnREaDTabs. (#152)
		tab.removeAttribute('selected');
	}

},

/****************************** TAB MANIPULATION *****************************/

clearTabId:function(aTab, aBrowser) {
	var browser = aBrowser || gBrowser.getBrowserForTab(aTab);
	browser.removeAttribute('tabControlId');
},

getTabId:function(aTab) {
	var browser = gBrowser.getBrowserForTab(aTab);
	return browser.getAttribute('tabControlId');
},

setTabId:function(aTab) {
	var browser = gBrowser.getBrowserForTab(aTab);
	if (!browser.hasAttribute('tabControlId')) {
		browser.setAttribute('tabControlId', ++gTabControl.tabId);
	}
},

changeTab:function(aEvent) {
	// #433 Break left-to-right groupings when selecting tabs.
	if (gTabControl.getPref('bool', 'browser.tabs.loadInBackground')) {
		for (var i=0, tab=null; tab=gBrowser.tabs[i]; i++) {
			gTabControl.clearTabId(tab);
		}
	}
},

tabProgressListener:{
	onLocationChange:function(aBrowser, aWebProgress, aRequest, aLocation) {
		gTabControl.clearTabId(null, aBrowser);
	}
},

handleSearchCommand:function(aEvent) {
	var searchbar=document.getElementById('searchbar');

	if ('keypress'==aEvent.type
			&& 13==aEvent.which && aEvent.ctrlKey
	) {
		//specifically open search in new tab
		searchbar.doSearch(searchbar._textbox.value, 'tab');
	} else {
		//call original function to handle things as it will
		gTabControl.origHandleSearchCommand.apply(searchbar, [aEvent]);
	}
},

/******************************** PREFERENCES ********************************/

getPref:function(aType, aName) {
	try {
		switch(aType) {
		case 'bool':   return this.prefObj.getBoolPref(aName);
		case 'int':    return this.prefObj.getIntPref(aName);
		case 'string':
		default:       return this.prefObj.getCharPref(aName);
		}
	} catch (e) { }
	return '';
},

setPref:function(aType, aName, aValue) {
	try {
		switch (aType) {
		case 'bool':   this.prefObj.setBoolPref(aName, aValue); break;
		case 'int':    this.prefObj.setIntPref(aName, aValue); break;
		case 'string':
		default:       this.prefObj.setCharPref(aName, aValue); break;
		}
	} catch (e) {  }
},

loadOptions:function() {
	//checkboxes
	var checks=window.document.getElementsByTagName('checkbox');
	for (var i=0; checks[i]; i++) {
		try {
			checks[i].checked=gTabControl.getPref('bool', checks[i].getAttribute('prefstring'));
		} catch (e) {  }
	}

	//dropdowns
	var drops=window.document.getElementsByTagName('menulist');
	for (var i=0; drops[i]; i++) {
		try {
			drops[i].selectedItem=drops[i].getElementsByAttribute(
				'value',
				gTabControl.getPref('int', drops[i].getAttribute('prefstring'))
			)[0];
		} catch (e) {  }
	}

	return true;
},

saveOptions:function() {
	//checkboxes
	var checks=window.document.getElementsByTagName('checkbox');
	for (var i=0; checks[i]; i++) {
		try {
			gTabControl.setPref(
				'bool',
				checks[i].getAttribute('prefstring'),
				checks[i].checked
			);
		} catch (e) {  }
	}

	//dropdowns
	var drops=window.document.getElementsByTagName('menulist');
	for (var i=0; drops[i]; i++) {
		try {
			gTabControl.setPref(
				'int',
				drops[i].getAttribute('prefstring'),
				drops[i].selectedItem.value
			);
		} catch (e) {  }
	}

	return true;
}

};

//add listener for onload handler
window.addEventListener('load', gTabControl.onLoad, false);
