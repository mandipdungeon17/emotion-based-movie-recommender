import http.client

headers = {
    'Authorization': 'Bearer 2|orm8s8TMSQSZcziQOXZwOgmRsrsW233VqoAP5oeU',
    'Accept': 'application/json'
}

conn = http.client.HTTPSConnection('api.movieposterdb.com')
conn.request('GET', '/v1/posters', headers=headers)  # <-- headers= keyword is the fix
res = conn.getresponse()
data = res.read()
print(res.status, res.reason)
print(data.decode('utf-8'))