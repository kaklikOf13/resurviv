export const api = {
    resolveUrl: function(url) {
        return url;
    },
    resolveRoomHost: function() {
        return window.location.host;
    },
    changePort(url="",port){
        const idx=url.indexOf(":",1)
        if(idx!=-1){
            url=url.substring(0,idx)
        }
        url+=`:${port}`
        return url
    }
};