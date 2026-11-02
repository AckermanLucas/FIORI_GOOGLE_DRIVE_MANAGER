sap.ui.define([], () => {
    "use strict";

    function getInfo(sMime) {
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
    }

    return {
        getInfo: getInfo,
        formatMimeIcon(sMime) { return getInfo(sMime).icon; },
        formatMimeLabel(sMime) { return getInfo(sMime).label; },
        formatMimeState(sMime) { return getInfo(sMime).state; },
        formatMimeColor(sMime) { return getInfo(sMime).color; }
    };
});