import re
with open(r'D:\Self\WorkSpace\Web\Intelishop\intelishop_frontend\index.html', encoding='utf-8') as f:
    content = f.read()
for eid in ['vendor-product-modal','vendor-voucher-modal','shipper-order-detail-modal','product-detail-modal','ai-panel-backdrop','chat-toggle-btn','ai-side-panel','chat-messages','chat-input','vendor-product-form','vendor-voucher-form']:
    c = len(re.findall('id="' + eid + '"', content))
    print(eid + ' = ' + str(c))

