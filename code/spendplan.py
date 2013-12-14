import calendar, datetime
import yaml
import dropbox, dropbox.datastore
from dateutil import parser
from csv import reader


app_key = 'i86ppgkz7etf1vk'
access_tokens = yaml.load(open('/home/rothlmar/.dropbox_access_token').read())
access_token = access_tokens.get(app_key)

if access_token == None:
    app_secret = raw_input('Enter the app secret: ')
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

def choose_account():
    all_accounts = list(account_table.query())
    for idx, acct in enumerate(all_accounts):
        fields = acct.get_fields()
        print("{0}: {acctname} ({currency})".format(idx,**fields))
    acct_num = int(raw_input("Which account? "))
    return all_accounts[acct_num].get_id()


#TFCU field_dict: {'Category': 3, 'Date': 1, 'Note': 2, 'credit': 5, 'debit': 4}, start_line: 4, False
#Bank of America: {'Date':0, 'Note':1, 'credit':2, 'debit':2, 'Category':0}, start_line: 8, False
#Barclays: {'Category': 4, 'Date': 1, 'Note': 5, 'credit': 3, 'debit': 3}, start_line: 1, False, '%d/%m/%Y'

def create_records(filename, field_dict, start, end, use_minus=True,date_parse=None):
    acct_id = choose_account()
    trans_prototype = {'Date':'',
                       'Category':'',
                       'Amount':0,
                       'Account':'',
                       'Note':''}
    with open(filename,'r') as f:
        recs = [l for l in reader(f)]

    for rec in recs[start:end]:
        # print(rec)
        r_dict = dict(trans_prototype)
        if date_parse:
            r_dict['Date'] = datetime.datetime.strptime(rec[field_dict['Date']], date_parse)
        else:
            r_dict['Date'] = parser.parse(rec[field_dict['Date']])
        r_dict['Date'] = calendar.timegm(r_dict['Date'].timetuple())
        r_dict['Date'] = dropbox.datastore.Date(r_dict['Date'])
        r_dict['Note'] = rec[field_dict['Note']]
        r_dict['Category'] = rec[field_dict['Category']]
        r_dict['Account'] = acct_id
        if rec[field_dict['credit']].strip():
            r_dict['Amount'] = float(rec[field_dict['credit']].strip().replace(',',''))
        else:
            r_dict['Amount'] = float(rec[field_dict['debit']].strip().replace(',',''))
            if use_minus:
                r_dict['Amount'] *= -1
                                     
        transaction_table.insert(**r_dict)
    datastore.commit()

def update_exchange_rates():
    import json
    import requests
    exchange_table = datastore.get_table('exchange_rates')
    max_date = max([r.get('date').to_datetime_utc() for r in exchange_table.query()])
    start_date = max_date + datetime.timedelta(1)
    req_fmt_str = "http://openexchangerates.org/api/historical/{}.json?app_id=36646cf83ce04bc1af40246f9015db65"
    req_strs = [req_fmt_str.format((start_date + datetime.timedelta(i)).strftime('%Y-%m-%d')) for i in range((datetime.datetime.today() - start_date).days)]
    responses = [requests.get(rs) for rs in req_strs]
    json_content = [json.loads(r.content) for r in responses]
    good_content = [{
            'date': dropbox.datastore.Date.from_datetime_utc(datetime.datetime.fromtimestamp(j['timestamp'])-datetime.timedelta(hours=23)),
            'rate':j['rates']['GBP']} for j in json_content]
    for xr in good_content:
        exchange_table.insert(**xr)
    datastore.commit()

    
