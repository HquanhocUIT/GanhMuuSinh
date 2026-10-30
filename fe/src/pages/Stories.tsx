import { ArrowRight, Heart, Volume2 } from 'lucide-react';
import { useApp } from '../context';
import { PassportStamp } from '../components/Brand';

export default function Stories() {
  const { catalog, t, story } = useApp();
  return (
    <div className="container inner-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE PEOPLE BEHIND THE FLAVORS</span>
          <h1>{t('Gánh một đời, giữ một vị.', 'A lifetime behind every flavor.')}</h1>
          <p>
            {t(
              'Ngồi xuống một chút. Có những điều thật đẹp đằng sau những gánh hàng bình dị.',
              'Pull up a tiny stool. There is a beautiful world behind these little food carts.',
            )}
          </p>
        </div>
        <Heart size={38} strokeWidth={1} />
      </div>
      <p className="notice">
        {t(
          'Các mục ghi “minh họa” là nhân vật hư cấu. Nội dung cộng đồng có đường dẫn nguồn để đối chiếu; câu chuyện thực tế cần được người bán đồng ý chia sẻ.',
          'Entries marked illustrative are fictional. Community content includes source links; real stories require the vendor’s consent.',
        )}
      </p>
      <div className="stories-grid">
        {catalog.vendors.map((v, i) => (
          <article className="story-card" key={v.id}>
            <div className="story-card-top">
              <PassportStamp index={i} />
              <span>
                {v.area}
                <small>
                  {v.dataType === 'illustrative'
                    ? t('CÂU CHUYỆN MINH HỌA', 'ILLUSTRATIVE STORY')
                    : t('DANH MỤC CỘNG ĐỒNG', 'COMMUNITY DIRECTORY')}
                </small>
              </span>
            </div>
            <h2>{v.name}</h2>
            <p>
              {v.story
                ? `${v.story.split('. ').slice(0, 2).join('. ')}.`
                : t(
                    'Chưa có câu chuyện được phép chia sẻ. Mở thông tin gánh hàng để xem nguồn và cách ghé.',
                    'No story has been shared with permission yet. Open the vendor details to check the source.',
                  )}
            </p>
            <button className="button text-button" onClick={() => story(v)}>
              <Volume2 size={17} />
              {t('Nghe chuyện của gánh', 'Hear the story')}
              <ArrowRight size={17} />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
