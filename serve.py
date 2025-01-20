from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    # Change to the directory containing web files
    web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')
    os.chdir(web_dir)
    
    # Start server
    httpd = HTTPServer(('localhost', 8000), CORSRequestHandler)
    print(f'Server started at http://localhost:8000')
    httpd.serve_forever()
