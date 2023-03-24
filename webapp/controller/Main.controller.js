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
    "sap/m/MessageToast",
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
    MessageToast,
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
    let _oStartupParams = null;
    const _sTimeStamp = new Date().getTime();

    return Controller.extend("oup.pms.ecp.controller.Main", {
      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      onInit: function () {
        const oComponent = this.getOwnerComponent();
        const oDataModel = oComponent.getModel();
        const oConstDataModel = oComponent.getModel("constODataModel");
        const fnChangeMetadataModel = (_) => {
          oDataModel.setSizeLimit(500);
          oDataModel.setDeferredGroups(
            oDataModel.getDeferredGroups().concat([_sTimeStamp])
          );
        };
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

        // set model data
        _oViewModel.setData({
          busy: true,
          edit: false,
          layoutsAvailable: true,
          posid: "",
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

      handleCreatePO: function () {
        // start busy indicator
        _oViewModel.setProperty("/busy", true);

        // function import to create PO / contract
        _oView.getModel().callFunction("/Create_PO_Contract", {
          method: "POST",
          urlParameters: {
            ean11: _oStartupParams.ean11[0],
            matnr: _oStartupParams.matnr[0],
            posid: _oStartupParams.posid[0],
            prart: _oStartupParams.prart[0],
            pspid: _oStartupParams.pspid[0],
          },
          success: function (oData, _oResponse) {
            // success message
            MessageBox.success(oData.Message, {
              styleClass: _bCompact ? "sapUiSizeCompact" : "",
            });

            // end busy indicator
            _oViewModel.setProperty("/busy", false);
          },
          error: function (_oError) {
            try {
              // read error message
              const sResponseText = _oError.responseText;
              const oResponse = JSON.parse(sResponseText);
              const sErrorText = oResponse.error.message.value;

              // error message
              MessageBox.error(sErrorText, {
                styleClass: _bCompact ? "sapUiSizeCompact" : "",
              });
            } catch (error) {
              // unable to read error message
            }

            // end busy indicator
            _oViewModel.setProperty("/busy", false);
          },
        });
      },

      handleConfirm: function () {
        // start busy indicator
        _oViewModel.setProperty("/busy", true);

        // get view data from view context
        const oBindingContext = _oView.getBindingContext();
        const oViewData = oBindingContext.getObject();
        const sPath = oBindingContext.getPath();

        // OData Model
        const oDataModel = _oView.getModel();

        // function import to create PO / contract
        oDataModel.callFunction("/Confirm_MFG", {
          method: "POST",
          urlParameters: {
            matnr: _oStartupParams.matnr[0],
            posid: _oStartupParams.posid[0],
            pspid: _oStartupParams.pspid[0],
            zz_pk_cst2: oViewData.zz_pk_cst2,
            zz_qty_pub1: oViewData.zz_qty_pub1,
            zz_cost_layout: oViewData.zz_cost_layout,
            zz_spec_layout: oViewData.zz_spec_layout,

            // estimate 1
            zcr1: `${oViewData.zz_zcr}-${oViewData.zz_zcru}-${oViewData.zz_zcr_curr}`,
            zcv1: `${oViewData.zz_zcv}-${oViewData.zz_zcvu}-${oViewData.zz_zcv_curr}`,
            zefr1: `${oViewData.zz_zefr}-${oViewData.zz_zefru}-${oViewData.zz_zefr_curr}`,
            zhk1: `${oViewData.zz_zhk}-${oViewData.zz_zhku}-${oViewData.zz_zhk_curr}`,
            zmiv1: `${oViewData.zz_zmiv}-${oViewData.zz_zmivu}-${oViewData.zz_zmiv_curr}`,
            zot1: `${oViewData.zz_zot}-${oViewData.zz_zotu}-${oViewData.zz_zot_curr}`,
            zpk1: `${oViewData.zz_zpk}-${oViewData.zz_zpku}-${oViewData.zz_zpk_curr}`,
            ztp1: `${oViewData.zz_ztp}-${oViewData.zz_ztpu}-${oViewData.zz_ztp_curr}`,
            zzz1: `${oViewData.zz_zzz}-${oViewData.zz_zzzu}-${oViewData.zz_zzz_curr}`,

            // estimate 2
            zcr2: `${oViewData.zz_zcr_2}-${oViewData.zz_zcru_2}-${oViewData.zz_zcr_curr2}`,
            zcv2: `${oViewData.zz_zcv_2}-${oViewData.zz_zcvu_2}-${oViewData.zz_zcv_curr2}`,
            zefr2: `${oViewData.zz_zefr_2}-${oViewData.zz_zefru_2}-${oViewData.zz_zefr_curr2}`,
            zhk2: `${oViewData.zz_zhk_2}-${oViewData.zz_zhku_2}-${oViewData.zz_zhk_curr2}`,
            zmiv2: `${oViewData.zz_zmiv_2}-${oViewData.zz_zmivu_2}-${oViewData.zz_zmiv_curr2}`,
            zot2: `${oViewData.zz_zot_2}-${oViewData.zz_zotu_2}-${oViewData.zz_zot_curr2}`,
            zpk2: `${oViewData.zz_zpk_2}-${oViewData.zz_zpku_2}-${oViewData.zz_zpk_curr2}`,
            ztp2: `${oViewData.zz_ztp_2}-${oViewData.zz_ztpu_2}-${oViewData.zz_ztp_curr2}`,
            zzz2: `${oViewData.zz_zzz_2}-${oViewData.zz_zzzu_2}-${oViewData.zz_zzz_curr2}`,

            // estimate 3
            zcr3: `${oViewData.zz_zcr_3}-${oViewData.zz_zcru_3}-${oViewData.zz_zcr_curr3}`,
            zcv3: `${oViewData.zz_zcv_3}-${oViewData.zz_zcvu_3}-${oViewData.zz_zcv_curr3}`,
            zefr3: `${oViewData.zz_zefr_3}-${oViewData.zz_zefru_3}-${oViewData.zz_zefr_curr3}`,
            zhk3: `${oViewData.zz_zhk_3}-${oViewData.zz_zhku_3}-${oViewData.zz_zhk_curr3}`,
            zmiv3: `${oViewData.zz_zmiv_3}-${oViewData.zz_zmivu_3}-${oViewData.zz_zmiv_curr3}`,
            zot3: `${oViewData.zz_zot_3}-${oViewData.zz_zotu_3}-${oViewData.zz_zot_curr3}`,
            zpk3: `${oViewData.zz_zpk_3}-${oViewData.zz_zpku_3}-${oViewData.zz_zpk_curr3}`,
            ztp3: `${oViewData.zz_ztp_3}-${oViewData.zz_ztpu_3}-${oViewData.zz_ztp_curr3}`,
            zzz3: `${oViewData.zz_zzz_3}-${oViewData.zz_zzu_3}-${oViewData.zz_zzz_curr3}`,

            // quantity
            zqty1: oViewData.zz_qty,
            zqty2: oViewData.zz_qty2,
            zqty3: oViewData.zz_qty3,

            // weight
            zz_weight: oViewData.zz_weight || "",

            // printer
            zz_printer: oViewData.zz_printer || "",

            // ERPD-627: ECP Screen CR : Weight Calculation
            ZZ_FORMAT: oViewData.zz_format || "",
            ZZ_EXTENT: oViewData.zz_extent || "",
            ZZ_COVER_BOARD_WEIGHT: oViewData.zz_cover_board_weight || "",
            ZZ_PAPER_WEIGHT_N: oViewData.zz_paper_weight_n || "",

            // ERPD-XXX: ECP Screen CR: Manual Weight
            zz_weight_m: oViewData.zz_weight_m || "",
          },
          success: function (oData, _oResponse) {
            // success message
            // message toast
            MessageToast.show(oData.message);

            // update response values
            oDataModel.setProperty(`${sPath}/zz_pk_cst2`, oData.zz_pk_cst2);
            oDataModel.setProperty(`${sPath}/zz_un_cst1`, oData.zz_un_cst1);
            oDataModel.setProperty(`${sPath}/zz_tot_cost1`, oData.zz_tot_cost1);
            oDataModel.setProperty(`${sPath}/zz_tot_curr1`, oData.zz_tot_curr1);
            oDataModel.setProperty(`${sPath}/zz_un_curr`, oData.zz_un_curr);
            oDataModel.setProperty(`${sPath}/zz_un_cst2`, oData.zz_un_cst2);
            oDataModel.setProperty(`${sPath}/zz_un_cst3`, oData.zz_un_cst3);
            oDataModel.setProperty(`${sPath}/zz_tot_cost2`, oData.zz_tot_cost2);
            oDataModel.setProperty(`${sPath}/zz_tot_cost3`, oData.zz_tot_cost3);
            oDataModel.setProperty(`${sPath}/zz_un_curr2`, oData.zz_un_curr2);
            oDataModel.setProperty(`${sPath}/zz_un_curr3`, oData.zz_un_curr3);
            oDataModel.setProperty(`${sPath}/zz_tot_curr2`, oData.zz_tot_curr2);
            oDataModel.setProperty(`${sPath}/zz_tot_curr3`, oData.zz_tot_curr3);

            // importing parameters
            oDataModel.setProperty(`${sPath}/zz_zhk`, oData.zz_zhk);
            oDataModel.setProperty(`${sPath}/zz_zhku`, oData.zz_zhku);
            oDataModel.setProperty(`${sPath}/zz_zhk_curr`, oData.zz_zhk_curr);
            oDataModel.setProperty(`${sPath}/zz_zefr`, oData.zz_zefr);
            oDataModel.setProperty(`${sPath}/zz_zefru`, oData.zz_zefru);
            oDataModel.setProperty(`${sPath}/zz_zefr_curr`, oData.zz_zefr_curr);
            oDataModel.setProperty(`${sPath}/zz_zhk_2`, oData.zz_zhk_2);
            oDataModel.setProperty(`${sPath}/zz_zhku_2`, oData.zz_zhku_2);
            oDataModel.setProperty(`${sPath}/zz_zhk_curr2`, oData.zz_zhk_curr2);
            oDataModel.setProperty(`${sPath}/zz_zefr_2`, oData.zz_zefr_2);
            oDataModel.setProperty(`${sPath}/zz_zefru_2`, oData.zz_zefru_2);
            oDataModel.setProperty(
              `${sPath}/zz_zefr_curr2`,
              oData.zz_zefr_curr2
            );
            oDataModel.setProperty(`${sPath}/zz_zhk_3`, oData.zz_zhk_3);
            oDataModel.setProperty(`${sPath}/zz_zhku_3`, oData.zz_zhku_3);
            oDataModel.setProperty(`${sPath}/zz_zhk_curr3`, oData.zz_zhk_curr3);
            oDataModel.setProperty(`${sPath}/zz_zefr_3`, oData.zz_zefr_3);
            oDataModel.setProperty(`${sPath}/zz_zefru_3`, oData.zz_zefru_3);
            oDataModel.setProperty(
              `${sPath}/zz_zefr_curr3`,
              oData.zz_zefr_curr3
            );

            // ERPD-3265: Update Exchange rates in the ISBN cockpit after pressing "Confirm" button
            oDataModel.setProperty(`${sPath}/zz_er_eur`, oData.zz_er_eur);
            oDataModel.setProperty(`${sPath}/zz_er_gbp`, oData.zz_er_gbp);
            oDataModel.setProperty(`${sPath}/zz_er_hkd`, oData.zz_er_hkd);
            oDataModel.setProperty(`${sPath}/zz_er_usd`, oData.zz_er_usd);

            // ERPD-627: ECP Screen CR : Weight Calculation
            oDataModel.setProperty(`${sPath}/zz_weight`, oData.ZZ_WEIGHT);

            // end busy indicator
            _oViewModel.setProperty("/busy", false);
          },
          error: function (_oError) {
            try {
              // read error message
              const sResponseText = _oError.responseText;
              const oResponse = JSON.parse(sResponseText);
              const sErrorText = oResponse.error.message.value;

              // error message
              MessageBox.error(sErrorText, {
                styleClass: _bCompact ? "sapUiSizeCompact" : "",
              });
            } catch (error) {
              // unable to read error message
            }

            // end busy indicator
            _oViewModel.setProperty("/busy", false);
          },
        });
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
            _oView.getModel().resetChanges();

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
        const oComponent = this.getOwnerComponent();
        const oComponentData = oComponent.getComponentData();

        try {
          _oStartupParams = oComponentData.startupParameters;
        } catch (error) {
          _oStartupParams = jQuery.sap.getUriParameters().mParams;
        }

        // set impression number for header title
        _oViewModel.setProperty("/posid", _oStartupParams.posid[0]);

        _oView.bindElement({
          path: `/ZPMS_C_MFG_PROJ(matnr='${_oStartupParams.matnr[0]}',pspid='${_oStartupParams.pspid[0]}',ean11='${_oStartupParams.ean11[0]}',prart='${_oStartupParams.prart[0]}',posid='${_oStartupParams.posid[0]}')`,
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
              Promise.all([oPromise1, oPromise2, oPromise3, oPromise4]).finally(
                () => _oViewModel.setProperty("/busy", false)
              );
            },
          },
        });

        // if (_oStartupParams.supplierID && _oStartupParams.supplierID[0]) {
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
                  // 4: "Estimate 1|Main Costs|Total"
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
