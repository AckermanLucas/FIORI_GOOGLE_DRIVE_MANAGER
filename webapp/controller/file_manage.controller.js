sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/Device",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "com/saperp/fiori/filedrivemanage/model/formatter",
    "com/saperp/fiori/filedrivemanage/model/models",
    "com/saperp/fiori/filedrivemanage/util/ThemeManager"
], (Controller, MessageToast, MessageBox, Fragment, Device, Filter, FilterOperator, Sorter, formatter, models, ThemeManager) => {
    "use strict";

    const RANGESET = Device.media.RANGESETS.SAP_STANDARD_EXTENDED;

    return Controller.extend("com.saperp.fiori.filedrivemanage.controller.file_manage", {

        // Formatters exposés à la vue : formatter:'.formatter.xxx'
        formatter: formatter,

        // Base URL définie via le proxy ui5.yaml
        _cpiBaseUrl: "/http/manage/file/gd/v3",

        onInit() {
            // Initialisation des modèles locaux
            this.getView().setModel(models.createFilesModel(), "files");
            this.getView().setModel(models.createStatsModel(), "stats");

            // Modèle UI (thème, dernière synchro)
            var bDark = ThemeManager.isDark();
            this.getView().setModel(models.createUiModel(bDark), "ui");
            if (bDark) {
                ThemeManager.setTheme(true);
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
        _applyTheme(bDark) {
            ThemeManager.setTheme(bDark);
            this.getView().getModel("ui").setProperty("/dark", bDark);
            ThemeManager.persist(bDark);
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
                    test: (sMime) => formatter.getInfo(sMime).cat === this._sType
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
            var sFileName = oContext.getProperty("name") || "document";

            var sUrl = this._cpiBaseUrl + "/download?fileId=" + sFileId;

            // Création d'un élément <a> invisible pour forcer le téléchargement
            var oLink = document.createElement("a");
            oLink.href = sUrl;
            oLink.setAttribute("download", sFileName);
            document.body.appendChild(oLink);
            oLink.click();
            document.body.removeChild(oLink);
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

        // --- MODIFICATION / REMPLACEMENT FICHIER (dialogue = fragment) ---
        onOpenEditDialog() {
            var oTable = this.byId("filesTable");
            var oSelectedItem = oTable.getSelectedItem();
            if (!oSelectedItem) return;

            var oContext = oSelectedItem.getBindingContext("files");
            var sFileId = oContext.getProperty("id");
            var sCurrentName = oContext.getProperty("name");
            var oView = this.getView();

            // Contexte du fichier en cours de modification
            this._oEditCtx = { fileId: sFileId, currentName: sCurrentName };

            Fragment.load({
                id: oView.getId(),
                name: "com.saperp.fiori.filedrivemanage.view.fragments.EditFileDialog",
                controller: this
            }).then((oDialog) => {
                this._oEditDialog = oDialog;
                oView.addDependent(oDialog);
                this.byId("editNameInput").setValue(sCurrentName);
                oDialog.open();
            });
        },

        onEditModeSelect(oEvent) {
            var iIndex = oEvent.getParameter("selectedIndex");
            var oInput = this.byId("editNameInput");
            var oFileUploader = this.byId("editFileUploader");

            if (iIndex === 0) {
                // Option 1 : Renommer uniquement
                oInput.setEnabled(true);
                oInput.setValue(this._oEditCtx.currentName);
                oFileUploader.setEnabled(false);
                oFileUploader.clear();
            } else if (iIndex === 1) {
                // Option 2 : Remplacer le fichier (garde le nom actuel)
                oInput.setEnabled(false);
                oInput.setValue(this._oEditCtx.currentName);
                oFileUploader.setEnabled(true);
            } else {
                // Option 3 : Remplacer nom et fichier (nom issu du fichier uploadé)
                oInput.setEnabled(true);
                oFileUploader.setEnabled(true);
                var domRef = oFileUploader.getFocusDomRef();
                if (domRef && domRef.files[0]) {
                    oInput.setValue(domRef.files[0].name);
                }
            }
        },

        onEditFileChange() {
            var oFileUploader = this.byId("editFileUploader");
            var domRef = oFileUploader.getFocusDomRef();
            if (domRef && domRef.files[0]) {
                var sNewFileName = domRef.files[0].name;
                // Si on est sur l'option 3, on met à jour automatiquement le nom
                if (this.byId("editModeGroup").getSelectedIndex() === 2) {
                    this.byId("editNameInput").setValue(sNewFileName);
                }
            }
        },

        onEditSave() {
            var sNewName = this.byId("editNameInput").getValue().trim();
            var domRef = this.byId("editFileUploader").getFocusDomRef();
            var iMode = this.byId("editModeGroup").getSelectedIndex();
            var file = (iMode > 0 && domRef) ? domRef.files[0] : null;

            this._oEditDialog.close();
            this._updateFile(this._oEditCtx.fileId, sNewName, file, iMode);
        },

        onEditCancel() {
            this._oEditDialog.close();
        },

        onEditAfterClose() {
            this._oEditDialog.destroy();
            this._oEditDialog = null;
        },

        _updateFile(sFileId, sNewName, file, iMode) {
            this.getView().setBusy(true);
            var that = this;

            if (iMode === 0) {
                // Option 1 : Renommer uniquement (Envoi JSON simple)
                $.ajax({
                    url: that._cpiBaseUrl + "/update",
                    method: "PUT",
                    contentType: "application/json",
                    data: JSON.stringify({ fileId: sFileId, newName: sNewName }),
                    success: () => {
                        that.getView().setBusy(false);
                        MessageToast.show("Nom mis à jour avec succès !");
                        that.loadDriveFiles();
                    },
                    error: (err) => {
                        that.getView().setBusy(false);
                        MessageBox.error("Échec de la mise à jour : " + err.responseText);
                    }
                });
            } else {
                // Option 2 & 3 : Remplacer le fichier (avec ou sans nouveau nom)
                var reader = new FileReader();
                reader.onload = (e) => {
                    var rawData = e.target.result;
                    $.ajax({
                        url: that._cpiBaseUrl + "/update?fileId=" + sFileId + "&fileName=" + encodeURIComponent(sNewName),
                        method: "PUT",
                        data: rawData,
                        processData: false,
                        contentType: file.type || "application/octet-stream",
                        success: () => {
                            that.getView().setBusy(false);
                            MessageToast.show("Fichier et nom mis à jour avec succès !");
                            that.loadDriveFiles();
                        },
                        error: (err) => {
                            that.getView().setBusy(false);
                            MessageBox.error("Échec de la mise à jour : " + err.responseText);
                        }
                    });
                };
                reader.readAsArrayBuffer(file);
            }
        }

    });
});
