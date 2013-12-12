import yaml 
import dropbox.datastore
from csv import DictReader


app_key = 'i86ppgkz7etf1vk'
access_tokens = yaml.load(open('/home/rothlmar/.dropbox_access_token').read())
access_token = access_tokens.get(app_key)

if access_token == None:
    flow = dropbox.client.DropboxOAuth2FlowNoRedirect(app_key, app_secret)
    authorize_url = flow.start()
    print(authorize_url)
    code = raw_input("Enter auth code: ").strip()
    access_token, user_id = flow.finish(code)
    print("access token: ", access_token)

client = dropbox.client.DropboxClient(access_token)
print('linked account: {}'.format(client.account_info()['display_name']))
manager = dropbox.datastore.DatastoreManager(client)
datastore = manager.open_default_datastore()

account_table = datastore.get_table('accounts')
transaction_table = datastore.get_table('transactions')
exchange_table = datastore.get_table('exchange_rates')
group_table = datastore.get_table('groups')
category_table = datastore.get_table('categories')




