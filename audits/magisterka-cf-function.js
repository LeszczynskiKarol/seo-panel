// CloudFront Function (viewer-response) — magisterkaonline.com.pl
// - Konwertuje S3 302 (trailing-slash redirect) na 301
// - Dodaje X-Robots-Tag: noindex,nofollow dla *.pdf i *.docx
//   żeby Google nie indeksował załączników (Karol chce, żeby ruch szedł do artykułu HTML, nie do PDF/DOCX).
function handler(event) {
    var response = event.response;
    var request = event.request;
    var uri = request.uri.toLowerCase();

    if (response.statusCode === 302 && response.headers.location) {
        response.statusCode = 301;
        response.statusDescription = 'Moved Permanently';
    }

    if (uri.endsWith('.pdf') || uri.endsWith('.docx')) {
        response.headers['x-robots-tag'] = { value: 'noindex, nofollow' };
    }

    return response;
}
