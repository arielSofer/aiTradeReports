
import os.path
import base64
import json
import re
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from email.utils import parsedate_to_datetime

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

CLIENT_SECRET_FILE = 'client_secret_218876218712-ulr0kn7d9e16f9i7qdnoc1mn6raudna6.apps.googleusercontent.com.json'

def get_gmail_service():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CLIENT_SECRET_FILE):
                raise FileNotFoundError(f"Missing client secret file: {CLIENT_SECRET_FILE}")
                
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    return build('gmail', 'v1', credentials=creds)

def parse_email_body(payload):
    """Recursively extract text body from payload."""
    body = ""
    if 'parts' in payload:
        for part in payload['parts']:
            if part['mimeType'] == 'text/plain':
                data = part['body'].get('data')
                if data:
                    body += base64.urlsafe_b64decode(data).decode()
            elif part['mimeType'] == 'text/html':
                 data = part['body'].get('data')
                 if data:
                    html = base64.urlsafe_b64decode(data).decode()
                    # Simple tag stripping
                    body += re.sub('<[^<]+?>', ' ', html) 
            elif 'parts' in part: # Nested parts
                body += parse_email_body(part)
    elif payload.get('mimeType') == 'text/plain':
         data = payload['body'].get('data')
         if data:
             body = base64.urlsafe_b64decode(data).decode()
    elif payload.get('mimeType') == 'text/html':
         data = payload['body'].get('data')
         if data:
             html = base64.urlsafe_b64decode(data).decode()
             body = re.sub('<[^<]+?>', ' ', html)
    return body

def search_emails():
    service = get_gmail_service()
    
    # Query for ANY Topstep email to debug
    query = 'from:noreply@topstep.com'
    
    results = service.users().messages().list(userId='me', q=query, maxResults=10).execute()
    messages = results.get('messages', [])

    found_accounts = []

    if not messages:
        print("No emails found from noreply@topstep.com")
        return

    print(f"DEBUG: Found {len(messages)} emails. Checking subjects...")

    for msg in messages:
        message = service.users().messages().get(userId='me', id=msg['id']).execute()
        headers = message['payload']['headers']
        
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
        print(f"DEBUG Subject: {subject}")
        date_str = next((h['value'] for h in headers if h['name'] == 'Date'), None)
        
        if "Started" in subject:
             print(f"DEBUG Snippet: {message.get('snippet')}")
             print(f"DEBUG MimeType: {message['payload']['mimeType']}")
             # print(json.dumps(message['payload'], indent=2)) # Too large
             
        # Parse logic
        body = parse_email_body(message['payload'])
        # Example patterns (need to be adjusted based on real email format)
        # "Account: 150K Trading Combine"
        # "Login: 123456"
        if "Started" in subject:
             # Search in raw HTML if possible
             pass

        # Regex should probably be cleaner.
        
        # Try looser regex
        login_match = re.search(r'Login[:\s]+(\d+)', body)
        username_match = re.search(r'Username[:\s]+(\d+)', body)
        
        # Account Name: 50KTC-V2-...
        account_name_match = re.search(r'Account Name[:\s]+([A-Za-z0-9-]+)', body)
        
        login = None
        if login_match:
            login = login_match.group(1)
        elif username_match:
            login = username_match.group(1)
        elif account_name_match:
             # Use Account Name as login/id
             login = account_name_match.group(1)
        
        if login:
            print(f"  -> Found Account: {login}")
            
            # Try to get account size
            size = "Unknown"
            if "50K" in login: size = "50K"
            elif "100K" in login: size = "100K"
            elif "150K" in login: size = "150K"
            elif "300K" in login: size = "300K"
               
            found_accounts.append({
                "id": msg['id'],
                "date": date_str,
                "account_size": size,
                "login": login,
                "type": "Trading Combine",
                "subject": subject
            })

    # Deduplicate by login
    unique_accounts = {}
    for acc in found_accounts:
        if acc['login'] not in unique_accounts:
            unique_accounts[acc['login']] = acc
        else:
            # Keep the latest one if duplicate? Or keep all? 
            # Usually login is unique per account instance.
            pass
            
    print(json.dumps(list(unique_accounts.values()), indent=2))

if __name__ == '__main__':
    search_emails()
