sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/comp/smartform/SmartForm",
    "sap/ui/comp/smartform/Group",
    "sap/ui/comp/smartform/GroupElement",
    "sap/ui/comp/smartform/ColumnLayout",
    "sap/ui/comp/smartfield/SmartField",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/uxap/ObjectPageSection",
    "sap/uxap/ObjectPageSubSection",
    "sap/m/MessageBox",
    "sap/m/TextArea",
    "sap/m/MessageStrip",
  ],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */
  function (
    Controller,
    UIComponent,
    SmartForm,
    Group,
    GroupElement,
    ColumnLayout,
    SmartField,
    JSONModel,
    Filter,
    FilterOperator,
    ObjectPageSection,
    ObjectPageSubSection,
    MessageBox,
    TextArea,
    MessageStrip
  ) {
    "use strict";

    let _oView = null;
    let _oConstODataModel = null;
    let _oObjectPageLayout = null;
    let _oViewModel = new JSONModel();
    let _bLoadOnlyOnce = false;
    let _bCompact = null;

    return Controller.extend("oup.pms.ecp.controller.Main", {
      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      onInit: function () {
        const oComponent = this.getOwnerComponent();
        const oDataModel = oComponent.getModel();
        const oConstDataModel = oComponent.getModel("constODataModel");
        const fnChangeMetadataModel = (_) => oDataModel.setSizeLimit(500);
        const fnChangeConstMetadataModel = (_) =>
          oConstDataModel.setSizeLimit(500);

        // increase the odata model size
        oDataModel.metadataLoaded().then(fnChangeMetadataModel);
        oConstDataModel.metadataLoaded().then(fnChangeConstMetadataModel);

        // initialize constants
        _oView = this.getView();
        _oConstODataModel = oComponent.getModel("constODataModel");
        _oObjectPageLayout = _oView.byId("object-page-layout-id");

        // apply content density mode to root view
        _oView.addStyleClass(oComponent.getContentDensityClass());

        // size compact
        _bCompact = !!_oView.$().closest(".sapUiSizeCompact").length;

        // get pattern match
        // this.getRouter()
        //   .getRoute("RouteMain")
        //   .attachPatternMatched(() => {
        //     debugger;
        //   });

        // set model data
        _oViewModel.setData({
          busy: true,
          edit: false,
          layoutsAvailable: true,
        });

        // set local view model
        _oView.setModel(_oViewModel, "oViewModel");

        // bind element odata model to the view
        this._onPatternMatched();
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      handleEdit: function () {
        // to-dos on edit button action
      },

      handleDelete: function () {
        // get confirmation before delete
        if (bHasChanges) {
          const fnClose = (sAction) => {
            if (sAction !== MessageBox.Action.OK) {
              return;
            }

            // odata model instance
            const _oDataModel = _oView.getModel();

            // set batch process for deletion of rows
            _oDataModel.remove(_oView.getBindingContext().getPath(), {
              success: (_oData) => {},
              error: (_oError) => {},
            });
          };

          // check any row is selected before
          MessageBox.confirm(
            this.getResourceBundle().getText("DEL_CONFIRM_MSG"),
            {
              actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
              emphasizedAction: MessageBox.Action.OK,
              styleClass: _bCompact ? "sapUiSizeCompact" : "",
              onClose: fnClose,
            }
          );
        }
      },

      handleSave: function () {
        const fnClose = (sAction) => {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }

          _oView.getModel().submitChanges({
            success: (oData) => {
              try {
                // find the error status codes
                const aErrorResponse =
                  oData.__batchResponses[0].__changeResponses.find(
                    (obj) => obj.statusCode >= "400"
                  ) || [];

                if (aErrorResponse.length !== 0) {
                  // error handler
                }

                // toggle back to edit mode
                _oViewModel.setProperty("/edit", false);
              } catch (err) {}
            },
            error: (_oError) => {},
          });
        };

        // check any row is selected before
        MessageBox.confirm("Are you sure, you want to save changes?", {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          emphasizedAction: MessageBox.Action.OK,
          styleClass: _bCompact ? "sapUiSizeCompact" : "",
          onClose: fnClose,
        });
      },

      handleCancel: function () {
        const bHasChanges = _oView.getModel().hasPendingChanges();

        // reset the changes through model refresh
        if (bHasChanges) {
          const fnClose = (sAction) => {
            if (sAction !== MessageBox.Action.OK) {
              return;
            }

            // clear the changes/ reset
            _oView.getModel().refresh();

            // toggle back to non-edit mode
            _oViewModel.setProperty("/edit", false);
          };

          // check any row is selected before
          MessageBox.confirm("Are you sure, you want to discard the changes?", {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            styleClass: _bCompact ? "sapUiSizeCompact" : "",
            onClose: fnClose,
          });
        } else {
          // toggle back to non-edit mode
          _oViewModel.setProperty("/edit", false);
        }
      },

      /**
       * Convenience method for accessing the router.
       * @public
       * @returns {sap.ui.core.routing.Router} the router for this component
       */
      getRouter: function () {
        return UIComponent.getRouterFor(this);
      },

      getResourceBundle: function () {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
      },

      /* =========================================================== */
      /* internal eveent handlers                                    */
      /* =========================================================== */

      /**
       * Binds the view to the object path.
       * @function
       * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
       * @private
       */
      _onPatternMatched: function () {
        let supplierID;

        // get startup params from Owner Component
        // const startupParams = oComponent.getComponentData()
        //   .startupParameters;

        const oParameters = jQuery.sap.getUriParameters().mParams;

        _oView.bindElement({
          path: `/ZPMS_C_MFG_PROJ(matnr=${oParameters.matnr},pspid=${oParameters.pspid},ean11=${oParameters.ean11},prart=${oParameters.prart},posid=${oParameters.posid})`,
          events: {
            dataRequested: () => {
              _oViewModel.setProperty("/busy", true);
            },
            dataReceived: (oDataResponse) => {
              if (_bLoadOnlyOnce) {
                // end busy indicator
                _oViewModel.setProperty("/busy", false);
                return;
              }

              // initialize flag
              _bLoadOnlyOnce = true;

              const oData = oDataResponse.getParameter("data");

              // check for layout data if no layout data available display message - no layout maintained
              if (
                oData === undefined ||
                (oData.zz_role_layout === "" &&
                  oData.zz_cost_layout === "" &&
                  oData.zz_spec_layout === "")
              ) {
                // display no layout maintained error strip
                this._noLayoutMaintained();

                // end busy indicator
                _oViewModel.setProperty("/busy", false);

                // layout not available
                _oViewModel.setProperty("/layoutsAvailable", false);

                return;
              }

              // layout available
              _oViewModel.setProperty("/layoutsAvailable", true);

              // section one - zz_role_layout
              const oPromise1 = this._loadConstants(oData.zz_role_layout);

              // section two - zz_cost_layout
              const oPromise2 = this._loadConstants(oData.zz_cost_layout);

              // section three - zz_spec_layout
              const oPromise3 = this._loadConstants(oData.zz_spec_layout);

              // section four - notes
              const oPromise4 = this._loadConstants("Notes");

              // close all three promise
              Promise.all([
                oPromise1,
                oPromise2,
                oPromise3,
                oPromise4,
              ]).finally(() => _oViewModel.setProperty("/busy", false));
            },
          },
        });

        // if (startupParams.supplierID && startupParams.supplierID[0]) {
        //   // read Supplier ID. Every parameter is placed in an array therefore [0] holds the value
        // } else {
        //   this.getRouter().getTargets().display("detailNoObjectsAvailable");
        // }
      },

      _loadConstants: function (sLayout) {
        // read constants from service
        return new Promise((reslove, reject) => {
          // filters
          const filters = [
            new Filter("layout_name", FilterOperator.Contains, sLayout),
          ];

          // parameters
          const urlParameters = {
            $skip: 0,
            $top: 500,
          };

          // get layout data from constants
          _oConstODataModel.read("/ZPMS_C_MFG_PROJ_SCRNLAYOUT", {
            urlParameters,
            filters,
            success: (oDataResponse) => {
              const aData = oDataResponse.results || [];

              const fnAddFieldsToGroup = (
                key,
                aItems,
                oSmartForm,
                bShowTitle
              ) => {
                // create group to smart form
                const oGroup = this._createGroup(bShowTitle ? key : "");

                for (const item of aItems) {
                  // create group element to group
                  const oGroupElement = this._createGroupElement();

                  // field binding
                  const sBinding = item.fieldname.substring(
                    item.fieldname.lastIndexOf("_"),
                    0
                  );

                  // field is editable
                  const bEditable =
                    item.fieldname.substring(
                      item.fieldname.lastIndexOf("_") + 1
                    ) === "Y";

                  // create smart field to group element
                  const oSmartField = this._createSmartField(
                    sBinding,
                    bEditable,
                    false
                  );

                  // add smart field to group element
                  oGroupElement.addElement(oSmartField);

                  // add group element to group
                  oGroup.addGroupElement(oGroupElement);
                }

                // add group to smart form
                oSmartForm.addGroup(oGroup);
              };

              const fnEstimateLayout = (mGrouped, oSection) => {
                let index = 0;

                while (index < 3) {
                  const sEstimateNo = `Estimate ${index + 1}`;

                  // create sub section to section
                  const oSubSection = this._createSubSection(sEstimateNo);
                  let estimateIndex = 0;

                  // 0: "Estimate 1"
                  // 1: "Estimate 1|Main Costs|Total"
                  // 2: "Estimate 1|Main Costs|Unit"
                  // 3: "Estimate 1|Main Costs|Currency"
                  // 4: "Estimate 1|Main Costs| Total"
                  // 5: "Estimate 1|Other Costs|Total"
                  // 6: "Estimate 1|Other Costs|Unit"
                  // 7: "Estimate 1|Other Costs|Currency"
                  // 8: "Estimate 1|Totals"

                  while (estimateIndex < 4) {
                    let aItems, oSmartForm;

                    // create smart form to a block
                    oSmartForm = this._createSmartForm();

                    // first index
                    if (estimateIndex === 0) {
                      aItems = mGrouped.get(sEstimateNo);

                      // add group to smart form
                      fnAddFieldsToGroup(
                        sEstimateNo,
                        aItems,
                        oSmartForm,
                        false
                      );
                    }

                    // second index
                    else if (estimateIndex === 1) {
                      // set smart form title
                      oSmartForm.setTitle("Main Costs");

                      // group for total
                      aItems =
                        mGrouped.get(`${sEstimateNo}|Main Costs|Total`) || [];

                      // add group to smart form
                      fnAddFieldsToGroup("Total", aItems, oSmartForm, true);

                      // group for unit
                      aItems =
                        mGrouped.get(`${sEstimateNo}|Main Costs|Unit`) || [];

                      // add group to smart form
                      fnAddFieldsToGroup("Unit", aItems, oSmartForm, true);

                      // group for currency
                      aItems =
                        mGrouped.get(`${sEstimateNo}|Main Costs|Currency`) ||
                        [];

                      // add group to smart form
                      fnAddFieldsToGroup("Currency", aItems, oSmartForm, true);
                    }

                    // third index
                    else if (estimateIndex === 2) {
                      // set smart form title
                      oSmartForm.setTitle("Other Costs");

                      // group for total
                      aItems =
                        mGrouped.get(`${sEstimateNo}|Other Costs|Total`) || [];

                      // add group to smart form
                      fnAddFieldsToGroup("Total", aItems, oSmartForm, true);

                      // group for unit
                      aItems =
                        mGrouped.get(`${sEstimateNo}|Other Costs|Unit`) || [];

                      // add group to smart form
                      fnAddFieldsToGroup("Unit", aItems, oSmartForm, true);

                      // group for currency
                      aItems =
                        mGrouped.get(`${sEstimateNo}|Other Costs|Currency`) ||
                        [];

                      // add group to smart form
                      fnAddFieldsToGroup("Currency", aItems, oSmartForm, true);
                    }

                    // fourth index
                    else {
                      aItems = mGrouped.get(`${sEstimateNo}|Totals`) || [];

                      // add group to smart form
                      fnAddFieldsToGroup("Totals", aItems, oSmartForm, true);
                    }

                    // event delegate
                    oSmartForm.addEventDelegate({
                      onAfterRendering: (oContext) => {
                        try {
                          const oSmartFormDom = oContext.srcControl.$();
                          const oGridDom = oSmartFormDom.parent();

                          // style the form title
                          oSmartFormDom.find(".sapUiFormTitle").css({
                            border: "none",
                            "font-size": "1rem",
                            // "font-weight": "bold",
                          });

                          oGridDom.removeClass("sapUiRespGridSpanL6");
                          oGridDom.removeClass("sapUiRespGridSpanM6");
                          oGridDom.addClass("sapUiRespGridSpanL12");
                          oGridDom.addClass("sapUiRespGridSpanM12");
                        } catch (error) {
                          // layout not changed
                        }
                      },
                    });

                    // add block to sub section
                    oSubSection.addBlock(oSmartForm);

                    // increment index
                    estimateIndex++;
                  }

                  // add sub section to section
                  oSection.addSubSection(oSubSection);

                  // increment index
                  index++;
                }
              };

              if (aData.length !== 0) {
                // section title
                const sLayoutTitle = aData[0].layout_name.split(".")[1] || "";

                // create section to object page layout
                const oSection = this._createSection(sLayoutTitle);

                //----------------------------------------------------------
                // parse the data to create groups and add it to smart form
                //----------------------------------------------------------

                const mGrouped = this._groupBy(
                  aData,
                  (oData) => oData.groupname
                );
                const aMappedGroupedKeys = mGrouped.keys();
                let aGroupedKeys = [];

                // create an array
                for (const obj of aMappedGroupedKeys) {
                  aGroupedKeys.push(obj);
                }

                if (sLayoutTitle.toUpperCase() === "COST LAYOUT") {
                  aGroupedKeys = aGroupedKeys.filter(
                    (obj) =>
                      obj.split("|")[0].trim() !== "Estimate 1" &&
                      obj.split("|")[0].trim() !== "Estimate 2" &&
                      obj.split("|")[0].trim() !== "Estimate 3"
                  );
                }

                for (const key of aGroupedKeys) {
                  const aItems = mGrouped.get(key);

                  // create sub section to section
                  const oSubSection = this._createSubSection(key);

                  if (sLayoutTitle.toUpperCase() === "NOTES") {
                    // add block to sub section
                    oSubSection.addBlock(
                      this._createSmartField(
                        "notes" /* sBinding */,
                        true /* bEditable */,
                        true /* bNotesField */
                      )
                    );
                    // add block to sub section
                    oSubSection.addBlock(this._createTextArea("notes"));
                  } else {
                    // create smart form to a block
                    const oSmartForm = this._createSmartForm();

                    // add group to smart form
                    fnAddFieldsToGroup(key, aItems, oSmartForm, false);

                    // add block to sub section
                    oSubSection.addBlock(oSmartForm);
                  }

                  // add sub section to section
                  oSection.addSubSection(oSubSection);
                }

                if (sLayoutTitle.toUpperCase() === "COST LAYOUT") {
                  fnEstimateLayout(mGrouped, oSection);
                }

                // add section to object page layout
                _oObjectPageLayout.addSection(oSection);
              }

              reslove();
            },
            error: (_oError) => reject(),
          });
        });
      },

      _noLayoutMaintained: function () {
        // get section title
        const sTitle = this.getResourceBundle().getText("ERROR");

        // create section to object page layout
        const oSection = this._createSection(sTitle);

        // create sub section to section
        const oSubSection = this._createSubSection(sTitle);

        // message strip
        const oMessageStrip = new MessageStrip({
          text: this.getResourceBundle().getText("NO_LAYOUT_MSG"),
          type: "Error",
          showIcon: true,
          showCloseButton: false,
        });

        // add block to sub section
        oSubSection.addBlock(oMessageStrip);

        // add sub section to section
        oSection.addSubSection(oSubSection);

        // add section to object page layout
        _oObjectPageLayout.addSection(oSection);
      },

      _createSection: (sTitle) => {
        return new ObjectPageSection({
          title: sTitle.toUpperCase().split(" ")[0],
          showTitle: true,
        });
      },

      _createSubSection: (sTitle) => {
        return new ObjectPageSubSection({
          titleUppercase: true,
          title: sTitle.toUpperCase(),
        });
      },

      _createSmartForm: () => {
        // layout
        const oLayout = new ColumnLayout({
          columnsM: 1,
          columnsL: 3,
          columnsXL: 3,
        });

        // smart form
        return new SmartForm({
          editable: `{oViewModel>/edit}`,
          layout: oLayout,
        }).addStyleClass("sapUxAPObjectPageSubSectionAlignContent");
      },

      _createGroup: (sTitle) => {
        // smart group
        return new Group({
          label: sTitle,
        });
      },

      _createGroupElement: () => {
        // smart group element
        return new GroupElement();
      },

      _createSmartField: (sBinding, bEditable, bNotesField) => {
        // smart field
        let oField = new SmartField({
          value: `{${sBinding}}`,
          editable: bEditable,
          textInEditModeSource: "ValueList",
          configuration: {
            displayBehaviour: "descriptionAndId",
          },
        });

        // change in smart control parameters for notes property
        if (bNotesField) {
          oField = new SmartField({
            value: `{${sBinding}}`,
            editable: false,
            visible: "{=!${oViewModel>/edit}}",
          });
        }

        return oField;
      },

      _createTextArea: (sBinding) => {
        return new TextArea({
          width: "100%",
          growing: true,
          growingMaxLines: 15,
          value: `{path: '${sBinding}',  mode: 'TwoWay'}`,
          visible: "{oViewModel>/edit}",
        });
      },

      /**
       * @description
       * Takes an Array<V>, and a grouping function,
       * and returns a Map of the array grouped by the grouping function.
       *
       * @param list An array of type V.
       * @param keyGetter A Function that takes the the Array type V as an input, and returns a value of type K.
       *                  K is generally intended to be a property key of V.
       *
       * @returns Map of the array grouped by the grouping function.
       */
      // export function groupBy<K, V>(list: Array<V>, keyGetter: (input: V) => K): Map<K, Array<V>> {
      // const map = new Map<K, Array<V>>();
      _groupBy: (list, keyGetter) => {
        const map = new Map();
        list.forEach((item) => {
          const key = keyGetter(item);
          const collection = map.get(key.trim());
          if (!collection) {
            map.set(key.trim(), [item]);
          } else {
            collection.push(item);
          }
        });
        return map;
      },
    });
  }
);
