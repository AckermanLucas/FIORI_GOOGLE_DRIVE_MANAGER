sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Theming",
    "sap/ui/Device",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/VBox"
], (Controller, JSONModel, MessageToast, MessageBox, Theming, Device, Filter, FilterOperator, Sorter, Dialog, Button, Input, Label, VBox) => {
    "use strict";

    const THEME_KEY = "fmDriveTheme";
    const RANGESET = Device.media.RANGESETS.SAP_STANDARD_EXTENDED;

    return Controller.extend("com.saperp.fiori.filedrivemanage.controller.file_manage", {

        // Base URL définie via le proxy ui5.yaml
        _cpiBaseUrl: "/http/manage/file/gd/v3",

        onInit() {
            // Initialisation des modèles locaux
            this.getView().setModel(new JSONModel({ items: [] }), "files");
            this.getView().setModel(new JSONModel({
                totalCount: 0, pdfCount: 0, imageCount: 0, otherCount: 0,
                pdfPercent: 0, imagePercent: 0, otherPercent: 0
            }), "stats");

            // Modèle UI (thème, dernière synchro)
            var bDark = this._readTheme();
            this.getView().setModel(new JSONModel({ dark: bDark, lastSync: "-" }), "ui");
            if (bDark) {
                Theming.setTheme("sap_horizon_dark");
            }

            this._sQuery = "";
            this._sType = "all";
            this._bDesc = false;
            this._sPage = "home";

            // Sidebar responsive
            this._fnMedia = this._onMediaChange.bind(this);
            Device.media.attachHandler(this._fnMedia, null, RANGESET);
            this._onMediaChange(Device.media.getCurrentRange(RANGESET));

            // Charger les fichiers au démarrage
            this.loadDriveFiles();
        },

        onExit() {
            Device.media.detachHandler(this._fnMedia, null, RANGESET);
        },

        _onMediaChange(oRange) {
            var bBig = oRange.name === "Desktop" || oRange.name === "LargeDesktop";
            var oToolPage = this.byId("toolPage");
            if (oToolPage) {
                oToolPage.setSideExpanded(bBig);
            }
        },

        // --- FORMATTERS (type de fichier) ---
        _getInfo(sMime) {
            var s = (sMime || "").toLowerCase();
            if (s.includes("pdf")) {
                return { cat: "pdf", icon: "sap-icon://pdf-attachment", label: "PDF", state: "Error", color: "Negative" };
            }
            if (s.includes("image")) {
                return { cat: "image", icon: "sap-icon://attachment-photo", label: "Image", state: "Information", color: "Neutral" };
            }
            if (s.includes("spreadsheet") || s.includes("excel") || s.includes("csv")) {
                return { cat: "other", icon: "sap-icon://excel-attachment", label: "Tableur", state: "Success", color: "Positive" };
            }
            if (s.includes("presentation") || s.includes("powerpoint")) {
                return { cat: "other", icon: "sap-icon://ppt-attachment", label: "Présentation", state: "Warning", color: "Critical" };
            }
            if (s.includes("word") || s.includes("document")) {
                return { cat: "other", icon: "sap-icon://doc-attachment", label: "Document", state: "Information", color: "Neutral" };
            }
            if (s.includes("zip") || s.includes("compressed") || s.includes("rar")) {
                return { cat: "other", icon: "sap-icon://attachment-zip-file", label: "Archive", state: "None", color: "Default" };
            }
            if (s.includes("video")) {
                return { cat: "other", icon: "sap-icon://attachment-video", label: "Vidéo", state: "None", color: "Default" };
            }
            if (s.includes("audio")) {
                return { cat: "other", icon: "sap-icon://attachment-audio", label: "Audio", state: "None", color: "Default" };
            }
            if (s.includes("text") || s.includes("json") || s.includes("xml")) {
                return { cat: "other", icon: "sap-icon://attachment-text-file", label: "Texte", state: "None", color: "Default" };
            }
            if (s.includes("folder")) {
                return { cat: "other", icon: "sap-icon://folder-blank", label: "Dossier", state: "None", color: "Default" };
            }
            return { cat: "other", icon: "sap-icon://document", label: "Fichier", state: "None", color: "Default" };
        },
        formatMimeIcon(sMime) { return this._getInfo(sMime).icon; },
        formatMimeLabel(sMime) { return this._getInfo(sMime).label; },
        formatMimeState(sMime) { return this._getInfo(sMime).state; },
        formatMimeColor(sMime) { return this._getInfo(sMime).color; },

        // --- NAVIGATION & SIDEBAR ---
        onSideNavButtonPress() {
            var oToolPage = this.byId("toolPage");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        onNavItemSelect(oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oNavContainer = this.byId("navContainer");

            // Item "mode sombre" : on bascule le thème sans changer de page
            if (sKey === "theme") {
                this._applyTheme(!this.getView().getModel("ui").getProperty("/dark"));
                this.byId("sideNavigation").setSelectedKey(this._sPage);
                return;
            }

            this._sPage = sKey;
            if (sKey === "home") {
                oNavContainer.to(this.byId("pageHome"));
            } else if (sKey === "files") {
                oNavContainer.to(this.byId("pageFiles"));
            }

            // Sur mobile, on referme le menu après le choix
            if (Device.system.phone) {
                this.byId("toolPage").setSideExpanded(false);
            }
        },

        navToFiles() {
            this._sPage = "files";
            this.byId("navContainer").to(this.byId("pageFiles"));
            this.byId("sideNavigation").setSelectedKey("files");
        },

        // --- MODE SOMBRE (NIGHT MODE) ---
        _readTheme() {
            try {
                return window.localStorage.getItem(THEME_KEY) === "dark";
            } catch (e) {
                return false;
            }
        },

        _applyTheme(bDark) {
            Theming.setTheme(bDark ? "sap_horizon_dark" : "sap_horizon");
            this.getView().getModel("ui").setProperty("/dark", bDark);
            try {
                window.localStorage.setItem(THEME_KEY, bDark ? "dark" : "light");
            } catch (e) { /* ignore */ }
        },

        // --- CHARGEMENT DES FICHIERS (GET /list) ---
        loadDriveFiles() {
            var oView = this.getView();
            oView.setBusy(true);

            $.ajax({
                url: this._cpiBaseUrl + "/new",
                method: "GET",
                success: (data) => {
                    oView.setBusy(false);
                    var aFiles = (typeof data === "string") ? JSON.parse(data) : (data.files || data);

                    // Mise à jour du modèle des fichiers
                    oView.getModel("files").setProperty("/items", aFiles);

                    // Calcul des KPI pour le Dashboard Home
                    var iTotal = aFiles.length;
                    var iPdf = aFiles.filter(f => f.mimeType && f.mimeType.includes("pdf")).length;
                    var iImg = aFiles.filter(f => f.mimeType && f.mimeType.includes("image")).length;
                    var iOther = Math.max(iTotal - iPdf - iImg, 0);
                    var fnPct = (n) => iTotal ? Math.round((n / iTotal) * 100) : 0;

                    oView.getModel("stats").setData({
                        totalCount: iTotal,
                        pdfCount: iPdf,
                        imageCount: iImg,
                        otherCount: iOther,
                        pdfPercent: fnPct(iPdf),
                        imagePercent: fnPct(iImg),
                        otherPercent: fnPct(iOther)
                    });

                    oView.getModel("ui").setProperty("/lastSync", new Date().toLocaleString("fr-FR"));
                    this._resetSelection();
                    this._applyFilters();

                    MessageToast.show("Liste synchronisée avec CPI");
                },
                error: (err) => {
                    oView.setBusy(false);
                    MessageBox.error("Erreur lors de la récupération des fichiers CPI : " + err.responseText);
                }
            });
        },

        // --- SELECTION & ACTIVATION DES BOUTONS ---
        _setActionsEnabled(bEnabled) {
            ["btnDownload", "btnCopy", "btnEdit", "btnDelete"].forEach((sId) => {
                this.byId(sId).setEnabled(bEnabled);
            });
        },

        _resetSelection() {
            var oTable = this.byId("filesTable");
            if (oTable) {
                oTable.removeSelections(true);
            }
            this._setActionsEnabled(false);
        },

        onFileSelect(oEvent) {
            var bSelected = oEvent.getParameter("listItem").getSelected();
            this._setActionsEnabled(bSelected);
        },

        // --- RECHERCHE + FILTRE PAR TYPE + TRI ---
        onSearchFile(oEvent) {
            var sQuery = oEvent.getParameter("query");
            if (sQuery === undefined) {
                sQuery = oEvent.getParameter("newValue");
            }
            this._sQuery = sQuery || "";
            this._applyFilters();
        },

        onFilterType(oEvent) {
            this._sType = oEvent.getParameter("item").getKey();
            this._applyFilters();
        },

        _applyFilters() {
            var aFilter = [];
            if (this._sQuery) {
                aFilter.push(new Filter("name", FilterOperator.Contains, this._sQuery));
            }
            if (this._sType && this._sType !== "all") {
                aFilter.push(new Filter({
                    path: "mimeType",
                    test: (sMime) => this._getInfo(sMime).cat === this._sType
                }));
            }
            var oBinding = this.byId("filesTable").getBinding("items");
            if (oBinding) {
                oBinding.filter(aFilter);
            }
        },

        onSortName(oEvent) {
            this._bDesc = !this._bDesc;
            oEvent.getSource().setIcon(this._bDesc ? "sap-icon://sort-descending" : "sap-icon://sort-ascending");
            this.byId("filesTable").getBinding("items").sort(new Sorter("name", this._bDesc));
        },

        // --- UPLOAD FICHIER ---
        onUploadFile() {
            var oFileUploader = this.byId("fileUploader");
            var domRef = oFileUploader.getFocusDomRef();
            var file = domRef.files[0];

            if (!file) {
                MessageToast.show("Veuillez choisir un fichier.");
                return;
            }

            var reader = new FileReader();
            var that = this;
            this.getView().setBusy(true);

            reader.onload = (e) => {
                var rawData = e.target.result;

                $.ajax({
                    url: that._cpiBaseUrl + "/upload?fileName=" + encodeURIComponent(file.name),
                    method: "POST",
                    data: rawData,
                    processData: false,
                    contentType: file.type || "application/octet-stream",
                    success: () => {
                        that.getView().setBusy(false);
                        oFileUploader.clear();
                        MessageToast.show("Fichier uploadé avec succès !");
                        that.loadDriveFiles();
                    },
                    error: (err) => {
                        that.getView().setBusy(false);
                        oFileUploader.clear();
                        MessageBox.error("Échec de l'upload : " + err.responseText);
                    }
                });
            };
            reader.readAsArrayBuffer(file);
        },

        // --- DOWNLOAD FICHIER ---
        onDownloadFile() {
            var oTable = this.byId("filesTable");
            var oSelectedItem = oTable.getSelectedItem();
            if (!oSelectedItem) return;

            var oContext = oSelectedItem.getBindingContext("files");
            var sFileId = oContext.getProperty("id");

            window.open(this._cpiBaseUrl + "/download?fileId=" + sFileId, "_blank");
        },

        // --- COPIER L'ID ---
        onCopyId() {
            var oSelectedItem = this.byId("filesTable").getSelectedItem();
            if (!oSelectedItem) return;

            var sFileId = oSelectedItem.getBindingContext("files").getProperty("id");
            if (navigator.clipboard) {
                navigator.clipboard.writeText(sFileId).then(
                    () => MessageToast.show("ID copié dans le presse-papiers"),
                    () => MessageToast.show("Copie impossible")
                );
            }
        },

        // --- SUPPRESSION FICHIER ---
        onDeleteFile() {
            var oTable = this.byId("filesTable");
            var oSelectedItem = oTable.getSelectedItem();
            if (!oSelectedItem) return;

            var oContext = oSelectedItem.getBindingContext("files");
            var sFileId = oContext.getProperty("id");
            var sFileName = oContext.getProperty("name");
            var that = this;

            MessageBox.confirm("Voulez-vous vraiment supprimer « " + sFileName + " » ?", {
                title: "Confirmer la suppression",
                icon: MessageBox.Icon.WARNING,
                emphasizedAction: MessageBox.Action.OK,
                onClose: (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        that.getView().setBusy(true);
                        $.ajax({
                            url: that._cpiBaseUrl + "/delete?fileId=" + sFileId,
                            method: "DELETE",
                            success: () => {
                                that.getView().setBusy(false);
                                MessageToast.show("Fichier supprimé");
                                that.loadDriveFiles();
                            },
                            error: (err) => {
                                that.getView().setBusy(false);
                                MessageBox.error("Erreur de suppression : " + err.responseText);
                            }
                        });
                    }
                }
            });
        },

        // --- MODIFICATION NOM FICHIER ---
        onOpenEditDialog() {
            var oTable = this.byId("filesTable");
            var oSelectedItem = oTable.getSelectedItem();
            if (!oSelectedItem) return;

            var oContext = oSelectedItem.getBindingContext("files");
            var sFileId = oContext.getProperty("id");
            var sCurrentName = oContext.getProperty("name");
            var that = this;

            var oSave = new Button({
                text: "Enregistrer",
                type: "Emphasized",
                enabled: false,
                press: () => {
                    var sNewName = oInput.getValue().trim();
                    oDialog.close();
                    that._updateFileName(sFileId, sNewName);
                }
            });

            var oInput = new Input({
                value: sCurrentName,
                width: "100%",
                valueLiveUpdate: true,
                liveChange: (e) => {
                    var s = e.getParameter("value").trim();
                    oSave.setEnabled(!!s && s !== sCurrentName);
                },
                submit: () => {
                    if (oSave.getEnabled()) {
                        oSave.firePress();
                    }
                }
            });

            var oDialog = new Dialog({
                title: "Renommer le fichier",
                icon: "sap-icon://edit",
                contentWidth: "26rem",
                initialFocus: oInput,
                content: [
                    new VBox({
                        items: [new Label({ text: "Nouveau nom", labelFor: oInput.getId() }), oInput]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: oSave,
                endButton: new Button({
                    text: "Annuler",
                    press: () => { oDialog.close(); }
                }),
                afterClose: () => { oDialog.destroy(); }
            });

            oDialog.open();
        },

        _updateFileName(sFileId, sNewName) {
            this.getView().setBusy(true);
            var that = this;

            $.ajax({
                url: this._cpiBaseUrl + "/update",
                method: "PUT",
                contentType: "application/json",
                data: JSON.stringify({ fileId: sFileId, newName: sNewName }),
                success: () => {
                    that.getView().setBusy(false);
                    MessageToast.show("Nom mis à jour !");
                    that.loadDriveFiles();
                },
                error: (err) => {
                    that.getView().setBusy(false);
                    MessageBox.error("Échec de la mise à jour : " + err.responseText);
                }
            });
        }

    });
});