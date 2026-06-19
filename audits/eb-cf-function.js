// CloudFront Function (viewer-response)
// - Konwertuje S3 302 "Moved Temporarily" (trailing-slash redirect) na 301 "Moved Permanently"
// - Dodaje X-Robots-Tag: noindex dla *.pdf (silniejszy sygnał niż sam robots.txt)
function handler(event) {
    var response = event.response;
    var request = event.request;
    var uri = request.uri.toLowerCase();

    // 302 → 301: S3 website endpoint robi 302 dla folder bez trailing slash.
    if (response.statusCode === 302 && response.headers.location) {
        response.statusCode = 301;
        response.statusDescription = 'Moved Permanently';
    }

    // X-Robots-Tag dla PDF — żeby Google nie indeksował preview PDF mimo zewnętrznych linków
    if (uri.endsWith('.pdf')) {
        response.headers['x-robots-tag'] = { value: 'noindex, nofollow' };
    }

    return response;
}
